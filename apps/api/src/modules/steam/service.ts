import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { externalGame, game, user } from "@playdamnit/db/schema";
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
}

interface SteamMatch {
  gameId: number;
  minutes: number;
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

/**
 * The owned Steam games found in the catalog through IGDB's Steam links. One app can link to
 * several catalog entries (editions, ports); the base game with the most ratings wins.
 */
const matchToCatalog = async (owned: OwnedGame[]) => {
  const minutesByApp = new Map(owned.map((g) => [String(g.appid), g.playtime_forever]));
  const rows = await postgresDb
    .selectDistinctOn([externalGame.uid], { uid: externalGame.uid, gameId: game.id })
    .from(externalGame)
    .innerJoin(game, eq(game.id, externalGame.gameId))
    .where(
      and(
        eq(externalGame.sourceId, ExternalGameSourceId.Steam),
        inArray(externalGame.uid, [...minutesByApp.keys()]),
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
    const minutes = minutesByApp.get(row.uid ?? "") ?? 0;
    const prev = byGame.get(row.gameId);
    if (!prev || minutes > prev.minutes) {
      byGame.set(row.gameId, { gameId: row.gameId, minutes });
    }
  }
  return [...byGame.values()];
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
    const rows = matches.map((m) => ({
      gameId: m.gameId,
      status: m.minutes > 0 ? playedStatus : UserGameStatus.Backlog,
      platformId: PlatformId.Pc,
    }));
    if (rows.length === 0) {
      throw new BadRequestError("None of these Steam games are in the catalog.");
    }
    const result = await UserGameService.importUserGames(userId, rows, false, {
      source: UserGameSource.Steam,
      maxGames: MAX_STEAM_IMPORT,
    });
    // An import links the account, so the next sync needs no profile
    await postgresDb
      .update(user)
      .set({ steamId, steamSyncedAt: new Date() })
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

  static async unlink(userId: string) {
    await postgresDb
      .update(user)
      .set({ steamId: null, steamSyncedAt: null })
      .where(eq(user.id, userId));
    return { message: "Steam account unlinked" };
  }
}
