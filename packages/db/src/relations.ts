import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

// Relational query (RQB v2) definitions. Only the game catalog and library need them;
// Better Auth's adapter uses the plain query builder.
export const relations = defineRelations(
  {
    user: schema.user,
    session: schema.session,
    account: schema.account,
    verification: schema.verification,
    passkey: schema.passkey,
    apikey: schema.apikey,
    userMetadata: schema.userMetadata,
    userGames: schema.userGames,
    userFollows: schema.userFollows,
    igdbSearchLog: schema.igdbSearchLog,
    platform: schema.platform,
    genre: schema.genre,
    gameMode: schema.gameMode,
    theme: schema.theme,
    type: schema.type,
    websiteType: schema.websiteType,
    company: schema.company,
    collection: schema.collection,
    externalGameSource: schema.externalGameSource,
    game: schema.game,
    cover: schema.cover,
    screenshot: schema.screenshot,
    website: schema.website,
    video: schema.video,
    externalGame: schema.externalGame,
    gameLocalization: schema.gameLocalization,
    gameTimeToBeat: schema.gameTimeToBeat,
    gameToSimilarGame: schema.gameToSimilarGame,
    gameToPlatform: schema.gameToPlatform,
    gameToGenre: schema.gameToGenre,
    gameToGameMode: schema.gameToGameMode,
    gameToType: schema.gameToType,
    gameToTheme: schema.gameToTheme,
    gameToCompany: schema.gameToCompany,
    gameToCollection: schema.gameToCollection,
    syncState: schema.syncState,
    catalogDirty: schema.catalogDirty,
  },
  (r) => ({
    userGames: {
      game: r.one.game({
        from: r.userGames.gameId,
        to: r.game.id,
        optional: false,
      }),
    },
    game: {
      cover: r.one.cover({ from: r.game.id, to: r.cover.gameId }),
      screenshots: r.many.screenshot({ from: r.game.id, to: r.screenshot.gameId }),
      websites: r.many.website({ from: r.game.id, to: r.website.gameId }),
      platforms: r.many.platform({
        from: r.game.id.through(r.gameToPlatform.gameId),
        to: r.platform.id.through(r.gameToPlatform.platformId),
      }),
      genres: r.many.genre({
        from: r.game.id.through(r.gameToGenre.gameId),
        to: r.genre.id.through(r.gameToGenre.genreId),
      }),
      gameModes: r.many.gameMode({
        from: r.game.id.through(r.gameToGameMode.gameId),
        to: r.gameMode.id.through(r.gameToGameMode.gameModeId),
      }),
      types: r.many.type({
        from: r.game.id.through(r.gameToType.gameId),
        to: r.type.id.through(r.gameToType.typeId),
      }),
      similarGames: r.many.game({
        from: r.game.id.through(r.gameToSimilarGame.gameId),
        to: r.game.id.through(r.gameToSimilarGame.similarGameId),
        alias: "similar_games",
      }),
      themes: r.many.theme({
        from: r.game.id.through(r.gameToTheme.gameId),
        to: r.theme.id.through(r.gameToTheme.themeId),
      }),
      collections: r.many.collection({
        from: r.game.id.through(r.gameToCollection.gameId),
        to: r.collection.id.through(r.gameToCollection.collectionId),
      }),
      // Junction rows, not companies: the roles (developer/publisher) live on the row.
      // (`involvedCompanies` is still the legacy text column on game.)
      companyRoles: r.many.gameToCompany({
        from: r.game.id,
        to: r.gameToCompany.gameId,
      }),
      videos: r.many.video({ from: r.game.id, to: r.video.gameId }),
      externalGames: r.many.externalGame({ from: r.game.id, to: r.externalGame.gameId }),
      localizations: r.many.gameLocalization({
        from: r.game.id,
        to: r.gameLocalization.gameId,
      }),
      timeToBeat: r.one.gameTimeToBeat({ from: r.game.id, to: r.gameTimeToBeat.gameId }),
      parentGame: r.one.game({
        from: r.game.parentGameId,
        to: r.game.id,
        alias: "parent_game",
      }),
      versionParent: r.one.game({
        from: r.game.versionParentId,
        to: r.game.id,
        alias: "version_parent",
      }),
    },
    gameToCompany: {
      company: r.one.company({
        from: r.gameToCompany.companyId,
        to: r.company.id,
        optional: false,
      }),
    },
    externalGame: {
      source: r.one.externalGameSource({
        from: r.externalGame.sourceId,
        to: r.externalGameSource.id,
      }),
    },
    website: {
      websiteType: r.one.websiteType({ from: r.website.typeId, to: r.websiteType.id }),
    },
  }),
);
