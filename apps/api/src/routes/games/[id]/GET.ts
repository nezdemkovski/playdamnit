import { Elysia, t } from "elysia";
import { GameService } from "@/modules/game/service";

export const getGameById = new Elysia().get("/games/:id", {
  params: t.Object({
    id: t.Numeric(),
  }),
}, ({ params }) => GameService.findById(params.id));
