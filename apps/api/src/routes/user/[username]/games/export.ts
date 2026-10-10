import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService } from "@/modules/userGame/service";
import { libraryParams } from "@/modules/userGame/model";
import { toCSV } from "@/modules/userGame/csv";

const CSV_HEADERS = [
  "gameId",
  "gameName",
  "status",
  "rating",
  "review",
  "platformId",
  "addedAt",
  "endedAt",
  "source",
];

export const exportUserGames = new Elysia().use(betterAuth).get("/user/:username/games/export", {
  auth: true,
  params: libraryParams,
  query: t.Object({
    format: t.Optional(t.Union([t.Literal("json"), t.Literal("csv")])),
    download: t.Optional(t.String()),
  }),
}, async ({ params, user, query, set }) => {
  const { username } = params;
  const { format = "json", download = "true" } = query;

  UserGameService.assertOwnLibrary(username, user);

  const games = await UserGameService.exportUserGames(user.id);
  const date = new Date().toISOString().split("T")[0];
  const filename = `games-export-${username}-${date}.${format}`;

  if (download === "true") {
    set.headers["content-disposition"] = `attachment; filename="${filename}"`;
  }

  if (format === "csv") {
    set.headers["content-type"] = "text/csv; charset=utf-8";
    return toCSV(CSV_HEADERS, games);
  }

  return {
    username,
    exportedAt: new Date().toISOString(),
    totalGames: games.length,
    games,
  };
});
