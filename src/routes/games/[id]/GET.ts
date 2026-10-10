import { Elysia, t } from "elysia";
import { GameService } from "@/modules/game/service";

export const getGameById = new Elysia().get(
  "/games/:id",
  ({ params }) => GameService.findById(params.id),
  {
    params: t.Object({
      id: t.Numeric(),
    }),
  }
);
