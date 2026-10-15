import { Elysia } from "elysia";

import { meRoutes } from "./me";
import { recommendationRoutes } from "./me/recommendations";
import { tasteRoutes } from "./me/taste";
import { steamImportRoutes } from "./me/steam";
import { getSteamActivity } from "./user/[username]/steam-activity";

import { getUser } from "./user/[username]/GET";
import { userSocialRoutes } from "./user/[username]/social";
import { getUsers } from "./users/GET";

import { getCatalogLookups } from "./catalog/GET";
import { getHome } from "./home/GET";
import { getGames } from "./games/GET";
import { getGameById } from "./games/[id]/GET";
import { getGameReviews } from "./games/[id]/reviews/GET";
import { gameLikeRoutes } from "./games/[id]/like";
import { getGameListMembership } from "./games/[id]/lists/GET";
import { getGamesSearch } from "./games/search/GET";
import { getGameReleaseDays } from "./games/release-days/GET";
import { getGameShowcase } from "./games/showcase/GET";
import { getUserGames } from "./user/[username]/games/GET";
import { getUserGamesIndex } from "./user/[username]/games/index/GET";
import { getUserGame } from "./user/[username]/games/[id]/GET";
import { postUserGame } from "./user/[username]/games/POST";
import { deleteUserGame } from "./user/[username]/games/[id]/DELETE";
import { patchUserGame } from "./user/[username]/games/[id]/PATCH";
import { playthroughRoutes } from "./user/[username]/games/[id]/playthroughs";
import { exportUserGames } from "./user/[username]/games/export";
import { importUserGames } from "./user/[username]/games/import";

import { reviewRoutes } from "./reviews";
import { listRoutes } from "./lists";

import { postAIChat } from "./chat/ai/POST";

import { postIgdbWebhook } from "./webhooks/igdb/POST";

export const routes = new Elysia()
  .use(meRoutes)
  .use(steamImportRoutes)
  .use(recommendationRoutes)
  .use(tasteRoutes)
  .use(getSteamActivity)

  .use(getUser)
  .use(userSocialRoutes)
  .use(getUsers)

  .use(getCatalogLookups)
  .use(getHome)
  .use(getGames)
  .use(getGamesSearch)
  .use(getGameReleaseDays)
  .use(getGameShowcase)
  .use(getGameById)
  .use(getGameReviews)
  .use(gameLikeRoutes)
  .use(getGameListMembership)

  .use(getUserGames)
  .use(getUserGamesIndex)
  .use(getUserGame)
  .use(postUserGame)
  .use(patchUserGame)
  .use(deleteUserGame)
  .use(playthroughRoutes)
  .use(exportUserGames)
  .use(importUserGames)

  .use(reviewRoutes)
  .use(listRoutes)

  .use(postAIChat)

  .use(postIgdbWebhook);
