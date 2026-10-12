import { describe, expect, test } from "bun:test";

import { deriveGame } from "@/catalog/derive";
import type { IGDBGameResponse } from "@/utils/igdb/types";
import { ImageSource } from "@playdamnit/db/enums";

const now = new Date("2026-10-11T00:00:00Z");

const raw: IGDBGameResponse = {
  id: 7346,
  name: "The Legend of Zelda: Breath of the Wild",
  slug: "the-legend-of-zelda-breath-of-the-wild",
  updated_at: 1_700_000_000,
  first_release_date: 1_488_499_200,
  total_rating: 93.4,
  total_rating_count: 2500,
  game_type: { id: 0, type: "Main Game" },
  similar_games: [1029, 1029, 119133],
  alternative_names: [
    { id: 1, name: "ゼルダの伝説 ブレス オブ ザ ワイルド" },
    { id: 2, name: "BotW" },
  ],
  cover: { id: 100, image_id: "co3p2d", width: 264, height: 374 },
  screenshots: [{ id: 200, image_id: "sc1" }],
  videos: [
    { id: 300, name: "Trailer", video_id: "abc" },
    { id: 301, video_id: "" },
  ],
  websites: [
    { id: 400, url: "https://zelda.com", trusted: true, type: { id: 1, type: "Official Website" } },
  ],
  external_games: [{ id: 500, external_game_source: 1, uid: "123", url: "https://store" }],
  involved_companies: [
    { id: 1, company: { id: 70, name: "Nintendo", slug: "nintendo" }, publisher: true },
    { id: 2, company: { id: 70, name: "Nintendo", slug: "nintendo" }, developer: true },
    { id: 3, company: { id: 71, name: "Monolith Soft", slug: "monolith-soft" }, supporting: true },
  ],
  game_localizations: [
    { id: 600, name: "ゼルダ", region: 3, cover: { id: 601, image_id: "coloc" } },
  ],
  release_dates: [
    { id: 1, date: 1_488_499_200, date_format: 0, platform: 130 },
    { id: 2, date: 1_500_000_000, date_format: 2, platform: 41 },
  ],
  genres: [{ id: 31, name: "Adventure", slug: "adventure" }],
  platforms: [
    { id: 130, name: "Nintendo Switch", slug: "switch", abbreviation: "Switch" },
    { id: 41, name: "Wii U", slug: "wiiu" },
  ],
  themes: [{ id: 17, name: "Fantasy", slug: "fantasy" }],
  collections: [{ id: 106, name: "The Legend of Zelda", slug: "the-legend-of-zelda" }],
  keywords: [{ id: 9, name: "open world", slug: "open-world" }],
  hypes: 321,
};

describe("deriveGame", () => {
  const derived = deriveGame(raw, now);

  test("fills the game row from the document", () => {
    expect(derived.game).toMatchObject({
      id: 7346,
      gameType: 0,
      isPopular: true,
      hypes: 321,
      firstReleaseDatePrecision: "day",
      alternativeNames: ["ゼルダの伝説 ブレス オブ ザ ワイルド", "BotW"],
      searchNames:
        "The Legend of Zelda: Breath of the Wild ゼルダの伝説 ブレス オブ ザ ワイルド BotW",
      similarGameIds: [1029, 119133],
      igdbUpdatedAt: new Date(1_700_000_000 * 1000),
      lastSyncedAt: now,
      deletedAt: null,
    });
    expect(derived.game.raw).toBe(raw as unknown as Record<string, unknown>);
  });

  test("merges company roles per company", () => {
    expect(derived.companyRoles).toEqual([
      {
        gameId: 7346,
        companyId: 70,
        developer: true,
        publisher: true,
        porting: false,
        supporting: false,
      },
      {
        gameId: 7346,
        companyId: 71,
        developer: false,
        publisher: false,
        porting: false,
        supporting: true,
      },
    ]);
    expect(derived.lookups.companies.map((c) => c.id)).toEqual([70, 70, 71]);
  });

  test("keys media and links by IGDB id", () => {
    expect(derived.cover).toMatchObject({ id: 100, gameId: 7346, hash: "co3p2d" });
    expect(derived.screenshots).toEqual([
      { id: 200, gameId: 7346, hash: "sc1", source: ImageSource.Igdb, width: null, height: null },
    ]);
    expect(derived.videos).toEqual([{ id: 300, gameId: 7346, name: "Trailer", videoId: "abc" }]);
    expect(derived.websites[0]).toMatchObject({ id: 400, typeId: 1, trusted: true });
    expect(derived.externalGames[0]).toMatchObject({ id: 500, sourceId: 1, uid: "123" });
    expect(derived.localizations[0]).toMatchObject({ id: 600, regionId: 3, coverHash: "coloc" });
    expect(derived.lookups.websiteTypes).toEqual([{ id: 1, type: "Official Website" }]);
  });

  test("collects lookup rows and junction ids", () => {
    expect(derived.lookups.platforms).toEqual([
      { id: 130, name: "Nintendo Switch", slug: "switch", abbreviation: "Switch" },
      { id: 41, name: "Wii U", slug: "wiiu", abbreviation: null },
    ]);
    expect(derived.platformIds).toEqual([130, 41]);
    expect(derived.genreIds).toEqual([31]);
    expect(derived.themeIds).toEqual([17]);
    expect(derived.collectionIds).toEqual([106]);
  });

  test("copes with a bare document", () => {
    const bare = deriveGame({ id: 1, name: "X", slug: "x" }, now);
    expect(bare.game).toMatchObject({
      firstReleaseDatePrecision: null,
      gameType: null,
      alternativeNames: [],
      searchNames: "X",
      similarGameIds: [],
    });
    expect(bare.cover).toBeNull();
    expect(bare.companyRoles).toEqual([]);
  });
});
