import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  externalGame,
  game,
  steamPlaytime,
  user,
  userFollows,
  userGames,
} from "@playdamnit/db/schema";
import { UserGameSource, UserGameStatus } from "@playdamnit/db/enums";

import { getConfig } from "@/config";
import { db as postgresDb } from "@/db/postgres";
import { UserGameService } from "@/modules/userGame/service";
import { BadRequestError, NotFoundError, ServiceUnavailableError } from "@/utils/errors";
import { ExternalGameSourceId, PlatformId } from "@/utils/enums";

const STEAM_API = "https://api.steampowered.com";
const STEAM_TIMEOUT_MS = 15_000;
// Steam libraries run into the thousands; a cap keeps one import to one transaction
export const MAX_STEAM_IMPORT = 5000;
// Launched this recently counts as playing
const RECENT_SECONDS = 14 * 86_400;
// Statuses a recent launch lifts to "playing"; finished, dropped and playing are left alone
const PROMOTABLE: readonly UserGameStatus[] = [
  UserGameStatus.Backlog,
  UserGameStatus.WantToPlay,
  UserGameStatus.OnHold,
];
// A friends list is read from Steam at most this often per user
const FRIENDS_TTL_MS = 30 * 60_000;
const friendsCache = new Map<string, { at: number; steamIds: string[] }>();
// The background sync: accounts not synced for this long, this many per run, a pause between
const SYNC_AGAIN_AFTER = "5 hours";
const SYNC_BATCH = 200;
const SYNC_PAUSE_MS = 500;
const STEAM_ID64 = /^7656119\d{10}$/;
const PROFILE_URL = /steamcommunity\.com\/(profiles|id)\/([^/?#\s]+)/i;
const VANITY = /^[A-Za-z0-9_-]{2,32}$/;

interface OwnedGame {
  appid: number;
  name?: string;
  playtime_forever: number;
  /** Unix seconds; 0 when never launched (or before Steam tracked it) */
  rtime_last_played?: number;
}

interface SteamMatch {
  gameId: number;
  minutes: number;
  /** Unix seconds of the last launch, 0 when unknown */
  lastPlayed: number;
}

const steamGet = async <T>(path: string, params: Record<string, string>): Promise<T> => {
  const key = getConfig().steamApiKey;
  if (!key) throw new ServiceUnavailableError("Steam import is not configured");
  const url = new URL(path, STEAM_API);
  url.search = new URLSearchParams({ key, format: "json", ...params }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(STEAM_TIMEOUT_MS) });
  // Steam answers 400 for an id that isn't a profile
  if (response.status === 400) throw new NotFoundError("No such Steam profile.");
  if (!response.ok) throw new ServiceUnavailableError(`Steam answered ${response.status}`);
  return (await response.json()) as T;
};

/** A SteamID64 from what people paste: the id, a profile URL, or a custom URL name */
export const resolveSteamId = async (input: string): Promise<string> => {
  const raw = input.trim();
  if (STEAM_ID64.test(raw)) return raw;
  const url = PROFILE_URL.exec(raw);
  if (url?.[1].toLowerCase() === "profiles" && STEAM_ID64.test(url[2])) return url[2];
  const vanity = url?.[2] ?? raw;
  if (!VANITY.test(vanity)) throw new BadRequestError("That isn't a Steam profile link.");
  const result = await steamGet<{ response: { success: number; steamid?: string } }>(
    "/ISteamUser/ResolveVanityURL/v1/",
    { vanityurl: vanity },
  );
  if (result.response.success !== 1 || !result.response.steamid) {
    throw new NotFoundError("No such Steam profile.");
  }
  return result.response.steamid;
};

const ownedGames = async (steamId: string): Promise<OwnedGame[]> => {
  const result = await steamGet<{ response: { game_count?: number; games?: OwnedGame[] } }>(
    "/IPlayerService/GetOwnedGames/v1/",
    { steamid: steamId, include_appinfo: "1", include_played_free_games: "1" },
  );
  // A private profile (or private game details) answers with an empty object
  if (!result.response.games) {
    throw new BadRequestError("This Steam library is private. Make game details public in Steam.");
  }
  return result.response.games;
};

/** The profile's display name and URL (public even when the game details are private) */
const playerSummary = async (steamId: string) => {
  const result = await steamGet<{
    response: { players: { personaname?: string; profileurl?: string }[] };
  }>("/ISteamUser/GetPlayerSummaries/v2/", { steamids: steamId });
  const player = result.response.players[0];
  return { name: player?.personaname ?? null, url: player?.profileurl ?? null };
};

/**
 * The owned Steam games found in the catalog through IGDB's Steam links. One app can link to
 * several catalog entries (editions, ports); the base game with the most ratings wins.
 */
const matchToCatalog = async (owned: OwnedGame[]) => {
  const byApp = new Map(owned.map((g) => [String(g.appid), g]));
  const rows = await postgresDb
    .selectDistinctOn([externalGame.uid], { uid: externalGame.uid, gameId: game.id })
    .from(externalGame)
    .innerJoin(game, eq(game.id, externalGame.gameId))
    .where(
      and(
        eq(externalGame.sourceId, ExternalGameSourceId.Steam),
        inArray(externalGame.uid, [...byApp.keys()]),
        isNull(game.deletedAt),
      ),
    )
    .orderBy(
      externalGame.uid,
      sql`${game.versionParentId} is null desc`,
      sql`${game.totalRatingCount} desc nulls last`,
      game.id,
    );
  // Two apps can resolve to the same catalog game; keep the one played longest
  const byGame = new Map<number, SteamMatch>();
  for (const row of rows) {
    const app = byApp.get(row.uid ?? "");
    const minutes = app?.playtime_forever ?? 0;
    const lastPlayed = app?.rtime_last_played ?? 0;
    const prev = byGame.get(row.gameId);
    if (!prev || minutes > prev.minutes) {
      byGame.set(row.gameId, {
        gameId: row.gameId,
        minutes,
        lastPlayed: Math.max(lastPlayed, prev?.lastPlayed ?? 0),
      });
    }
  }
  return [...byGame.values()];
};

/**
 * Keeps each library entry's Steam playtime current: stores the minutes and last launch,
 * logs the minutes gained since the last sync on the day of the last launch (the activity
 * map; a first sync logs nothing, its total isn't one day's play), and lifts an entry to
 * "playing" when the game was launched recently. Unchanged entries aren't written.
 */
const recordPlaytime = async (userId: string, matches: SteamMatch[], recentSince: number) => {
  if (matches.length === 0) return;
  const entries = await postgresDb
    .select({
      id: userGames.id,
      gameId: userGames.gameId,
      status: userGames.status,
      steamMinutes: userGames.steamMinutes,
    })
    .from(userGames)
    .where(
      and(
        eq(userGames.userId, userId),
        inArray(
          userGames.gameId,
          matches.map((m) => m.gameId),
        ),
      ),
    );
  const byGame = new Map(entries.map((e) => [e.gameId, e]));
  await postgresDb.transaction(async (tx) => {
    for (const m of matches) {
      const entry = byGame.get(m.gameId);
      if (!entry) continue;
      const promote = m.lastPlayed > recentSince && PROMOTABLE.includes(entry.status);
      if (entry.steamMinutes === m.minutes && !promote) continue;
      const lastPlayed = m.lastPlayed ? new Date(m.lastPlayed * 1000) : null;
      const gained = entry.steamMinutes === null ? 0 : m.minutes - entry.steamMinutes;
      if (gained > 0) {
        await tx
          .insert(steamPlaytime)
          .values({
            userId,
            gameId: m.gameId,
            day: (lastPlayed ?? new Date()).toISOString().slice(0, 10),
            minutes: gained,
          })
          .onConflictDoUpdate({
            target: [steamPlaytime.userId, steamPlaytime.gameId, steamPlaytime.day],
            set: { minutes: sql`${steamPlaytime.minutes} + excluded.minutes` },
          });
      }
      await tx
        .update(userGames)
        .set({
          steamMinutes: m.minutes,
          steamLastPlayedAt: lastPlayed,
          ...(promote && { status: UserGameStatus.Playing }),
        })
        .where(eq(userGames.id, entry.id));
    }
  });
};

/** The profile given, or the Steam account already linked to the user */
const steamIdFor = async (userId: string, profile?: string) => {
  if (profile?.trim()) return resolveSteamId(profile);
  const row = await postgresDb.query.user.findFirst({
    where: { id: userId },
    columns: { steamId: true },
  });
  if (!row?.steamId) throw new BadRequestError("Connect a Steam profile first");
  return row.steamId;
};

export abstract class SteamService {
  /**
   * Adds the Steam library to the user's list on PC: never-launched games go to the backlog,
   * played ones to the status the user picked. Games already in the list are left alone, so
   * running it again only brings in what's new.
   */
  static async import(userId: string, playedStatus: UserGameStatus, profile?: string) {
    const steamId = await steamIdFor(userId, profile);
    const matches = await matchToCatalog(await ownedGames(steamId));
    const recentSince = Date.now() / 1000 - RECENT_SECONDS;
    const rows = matches.map((m) => ({
      gameId: m.gameId,
      status:
        m.minutes === 0
          ? UserGameStatus.Backlog
          : m.lastPlayed > recentSince
            ? UserGameStatus.Playing
            : playedStatus,
      platformId: PlatformId.Pc,
    }));
    if (rows.length === 0) {
      throw new BadRequestError("None of these Steam games are in the catalog.");
    }
    const result = await UserGameService.importUserGames(userId, rows, false, {
      source: UserGameSource.Steam,
      maxGames: MAX_STEAM_IMPORT,
    });
    await recordPlaytime(userId, matches, recentSince);
    // An import links the account, so the next sync needs no profile; the name may have changed
    const summary = await playerSummary(steamId).catch(() => null);
    await postgresDb
      .update(user)
      .set({
        steamId,
        steamSyncedAt: new Date(),
        ...(summary && { steamName: summary.name, steamProfileUrl: summary.url }),
      })
      .where(eq(user.id, userId));
    return result;
  }

  /**
   * The background sync: every linked account not synced for a while gets its new games,
   * oldest first. Failures (a library gone private, Steam down) are logged and skipped; the
   * account comes up again next run.
   */
  static async syncLinked(log: (message: string) => void) {
    const due = await postgresDb
      .select({ id: user.id })
      .from(user)
      .where(
        sql`${user.steamId} is not null and (${user.steamSyncedAt} is null or ${user.steamSyncedAt} < now() - ${SYNC_AGAIN_AFTER}::interval)`,
      )
      .orderBy(sql`${user.steamSyncedAt} asc nulls first`)
      .limit(SYNC_BATCH);
    let added = 0;
    for (const { id } of due) {
      try {
        const result = await SteamService.import(id, UserGameStatus.OnHold);
        added += result.imported;
      } catch (error) {
        log(`Steam sync skipped for ${id}: ${(error as Error).message}`);
      }
      await Bun.sleep(SYNC_PAUSE_MS);
    }
    log(`Steam sync: ${due.length} accounts, ${added} games added`);
  }

  /** Minutes played per UTC day over the last year, from Steam syncs (the activity map) */
  static async activity(ownerId: string) {
    const rows = await postgresDb
      .select({ day: steamPlaytime.day, minutes: sql<number>`sum(${steamPlaytime.minutes})::int` })
      .from(steamPlaytime)
      .where(and(eq(steamPlaytime.userId, ownerId), sql`${steamPlaytime.day} > current_date - 365`))
      .groupBy(steamPlaytime.day)
      .orderBy(steamPlaytime.day);
    return { days: rows.map((r) => ({ date: String(r.day), minutes: Number(r.minutes) })) };
  }

  /**
   * The user's Steam friends who are here too (linked their Steam), with whether the user
   * follows them. A private friends list gives nobody.
   */
  static async friends(userId: string) {
    const me = await postgresDb.query.user.findFirst({
      where: { id: userId },
      columns: { steamId: true },
    });
    if (!me?.steamId) return { users: [] };
    let cached = friendsCache.get(userId);
    if (!cached || Date.now() - cached.at > FRIENDS_TTL_MS) {
      const list = await steamGet<{ friendslist?: { friends: { steamid: string }[] } }>(
        "/ISteamUser/GetFriendList/v1/",
        { steamid: me.steamId, relationship: "friend" },
      ).catch(() => null);
      cached = { at: Date.now(), steamIds: list?.friendslist?.friends.map((f) => f.steamid) ?? [] };
      friendsCache.set(userId, cached);
    }
    if (cached.steamIds.length === 0) return { users: [] };
    const rows = await postgresDb
      .select({
        id: user.id,
        username: user.username,
        name: user.name,
        image: user.image,
        steamName: user.steamName,
        // "user".id spelled out: inside the subquery a bare "id" would be user_follows.id
        following: sql<boolean>`exists (select 1 from ${userFollows} where ${userFollows.followerId} = ${userId} and ${userFollows.followingId} = "user"."id")`,
      })
      .from(user)
      .where(and(inArray(user.steamId, cached.steamIds), sql`${user.id} <> ${userId}`));
    return {
      users: rows.map(({ following, ...u }) => ({ ...u, isFollowing: !!following })),
    };
  }

  static async unlink(userId: string) {
    await postgresDb
      .update(user)
      .set({ steamId: null, steamName: null, steamProfileUrl: null, steamSyncedAt: null })
      .where(eq(user.id, userId));
    return { message: "Steam account unlinked" };
  }
}
