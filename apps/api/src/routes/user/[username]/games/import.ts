import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserGameService, type ImportGameInput } from "@/modules/userGame/service";
import { libraryParams } from "@/modules/userGame/model";
import { parseCSV } from "@/modules/userGame/csv";
import { BadRequestError } from "@/utils/errors";
import { clientKey, createRateLimiter } from "@/utils/rateLimit";
import { FileExtension, isFlagSet, MimeType } from "@/utils/enums";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const importLimiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 });

const readImportFile = async (file: File): Promise<ImportGameInput[]> => {
  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestError(
      `File too large. Maximum allowed: ${MAX_FILE_SIZE / (1024 * 1024)}MB, provided: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
    );
  }

  const content = await file.text();

  if (file.type === MimeType.Csv || file.name.endsWith(FileExtension.Csv)) {
    return parseCSV(content);
  }

  let jsonData: unknown;
  try {
    jsonData = JSON.parse(content);
  } catch {
    throw new BadRequestError("Invalid JSON format in uploaded file");
  }

  if (Array.isArray(jsonData)) return jsonData;
  if (Array.isArray((jsonData as { games?: unknown })?.games)) {
    return (jsonData as { games: ImportGameInput[] }).games;
  }

  throw new BadRequestError("Invalid file format. Expected JSON with 'games' array or CSV format");
};

export const importUserGames = new Elysia().use(betterAuth).post(
  "/user/:username/games/import",
  {
    auth: true,
    params: libraryParams,
    body: t.Union([
      t.Object({
        games: t.Array(
          t.Object({
            gameId: t.Number(),
            status: t.String(),
            rating: t.Optional(t.Union([t.Number(), t.Null()])),
            review: t.Optional(t.Union([t.String(), t.Null()])),
            platformId: t.Optional(t.Union([t.Number(), t.Null()])),
            endedAt: t.Optional(t.Union([t.String(), t.Null()])),
          }),
        ),
        overwriteExisting: t.Optional(t.Boolean()),
      }),
      t.Object({
        file: t.File(),
        overwriteExisting: t.Optional(t.Union([t.String(), t.Boolean()])),
      }),
    ]),
  },
  async ({ params, user, body, request, server }) => {
    UserGameService.assertOwnLibrary(params.username, user);
    importLimiter.check(clientKey({ request, server }, user.id));

    const rows = "games" in body ? body.games : await readImportFile(body.file);
    const overwriteExisting = isFlagSet(body.overwriteExisting);

    return UserGameService.importUserGames(user.id, rows, overwriteExisting);
  },
);
