import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { externalGame, game, userGames } from "@playdamnit/db/schema";
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
const STEAM_ID64 = /^7656119\d{10}$/;
const PROFILE_URL = /steamcommunity\.com\/(profiles|id)\/([^/?#\s]+)/i;
const VANITY = /^[A-Za-z0-9_-]{2,32}$/;

interface OwnedGame {
  appid: number;
  name?: string;
  playtime_forever: number;
}

export interface SteamMatch {
  gameId: number;
  name: string;
  minutes: number;
}

const steamGet = async <T>(path: string, params: Record<string, string>): Promise<T> => {
  const key = getConfig().steamApiKey;
  if (!key) throw new ServiceUnavailableError("Steam import is not configured");
  const url = new URL(path, STEAM_API);
  url.search = new URLSearchParams({ key, format: "json", ...params }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(STEAM_TIMEOUT_MS) });
  // Steam answers 400 for an id that isn't a profile
  if (response.status === 400) throw new NotFoundError("No Steam profile with that id");
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
  if (!VANITY.test(vanity)) throw new BadRequestError("That doesn't look like a Steam profile");
  const result = await steamGet<{ response: { success: number; steamid?: string } }>(
    "/ISteamUser/ResolveVanityURL/v1/",
    { vanityurl: vanity },
  );
  if (result.response.success !== 1 || !result.response.steamid) {
    throw new NotFoundError("No Steam profile with that name");
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
    throw new BadRequestError(
      "Steam won't show this library. Set Game details to Public in your Steam privacy settings.",
    );
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
    .selectDistinctOn([externalGame.uid], {
      uid: externalGame.uid,
      gameId: game.id,
      name: game.name,
    })
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
      byGame.set(row.gameId, { gameId: row.gameId, name: row.name, minutes });
    }
  }
  return [...byGame.values()];
};

const libraryIds = async (userId: string, gameIds: number[]) =>
  new Set(
    gameIds.length
      ? (
          await postgresDb
            .select({ gameId: userGames.gameId })
            .from(userGames)
            .where(and(eq(userGames.userId, userId), inArray(userGames.gameId, gameIds)))
        ).map((r) => r.gameId)
      : [],
  );

export abstract class SteamService {
  /** What an import of this Steam profile would do, without writing anything */
  static async preview(userId: string, profile: string) {
    const steamId = await resolveSteamId(profile);
    const owned = await ownedGames(steamId);
    const matches = await matchToCatalog(owned);
    const inLibrary = await libraryIds(
      userId,
      matches.map((m) => m.gameId),
    );
    const fresh = matches.filter((m) => !inLibrary.has(m.gameId));
    return {
      steamId,
      owned: owned.length,
      matched: matches.length,
      unmatched: owned.length - matches.length,
      alreadyInLibrary: inLibrary.size,
      toImport: fresh.length,
      neverPlayed: fresh.filter((m) => m.minutes === 0).length,
      played: fresh.filter((m) => m.minutes > 0).length,
      hoursPlayed: Math.round(matches.reduce((sum, m) => sum + m.minutes, 0) / 60),
      mostPlayed: matches
        .filter((m) => m.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 5)
        .map((m) => ({ gameId: m.gameId, name: m.name, hours: Math.round(m.minutes / 60) })),
    };
  }

  /**
   * Adds the Steam library to the user's list on PC: never-launched games go to the backlog,
   * played ones to the status the user picked. Games already in the list are left alone.
   */
  static async import(userId: string, profile: string, playedStatus: UserGameStatus) {
    const steamId = await resolveSteamId(profile);
    const matches = await matchToCatalog(await ownedGames(steamId));
    const rows = matches.map((m) => ({
      gameId: m.gameId,
      status: m.minutes > 0 ? playedStatus : UserGameStatus.Backlog,
      platformId: PlatformId.Pc,
    }));
    if (rows.length === 0) {
      throw new BadRequestError("None of these Steam games are in the catalog yet");
    }
    return UserGameService.importUserGames(userId, rows, false, {
      source: UserGameSource.Steam,
      maxGames: MAX_STEAM_IMPORT,
    });
  }
}
