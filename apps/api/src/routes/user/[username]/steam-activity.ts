import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { SteamService } from "@/modules/steam/service";
import { ForbiddenError } from "@/utils/errors";
import { canSeeList, requireUser } from "@/utils/social";

/** Minutes played per day from Steam syncs, as private as the library */
export const getSteamActivity = new Elysia()
  .use(betterAuth)
  .get(
    "/user/:username/steam-activity",
    { viewer: true, params: t.Object({ username: t.String() }) },
    async ({ params, viewer }) => {
      const owner = await requireUser(params.username, viewer?.id ?? null);
      if (!canSeeList(owner, viewer?.id ?? null)) throw new ForbiddenError("This list is private");
      return SteamService.activity(owner.id);
    },
  );
