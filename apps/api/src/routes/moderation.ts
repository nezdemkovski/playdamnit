import { Elysia, t } from "elysia";
import { betterAuth } from "@/lib/betterAuth";
import { ModerationService } from "@/modules/moderation/service";
import { ContentKind, ReportReason, ReportStatus } from "@playdamnit/db/enums";
import { StringFormat } from "@/utils/enums";
import { createRateLimiter } from "@/utils/rateLimit";

const limiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });
const id = t.Object({ id: t.String({ minLength: 1, maxLength: 100 }) });
export const moderationRoutes = new Elysia()
  .use(betterAuth)
  .post(
    "/me/reports",
    {
      auth: true,
      body: t.Object({
        kind: t.Enum(ContentKind),
        targetId: t.String({ minLength: 1, maxLength: 100 }),
        reason: t.Enum(ReportReason),
      }),
    },
    ({ user, body }) => {
      limiter.check(user.id);
      return ModerationService.report(user.id, body);
    },
  )
  .get("/me/blocks", { auth: true }, ({ user }) => ModerationService.blocks(user.id))
  .put("/me/blocks/:id", { auth: true, params: id }, ({ user, params }) =>
    ModerationService.block(user.id, params.id),
  )
  .delete("/me/blocks/:id", { auth: true, params: id }, ({ user, params }) =>
    ModerationService.unblock(user.id, params.id),
  )
  .get(
    "/moderation/reports",
    {
      auth: true,
      query: t.Object({
        resolved: t.Optional(t.BooleanString({ default: false })),
        offset: t.Optional(t.Numeric({ minimum: 0, maximum: 100000, default: 0 })),
      }),
    },
    ({ user, query }) => ModerationService.queue(user.id, query.resolved, query.offset),
  )
  .get(
    "/moderation/suspensions",
    {
      auth: true,
      query: t.Object({
        offset: t.Optional(t.Numeric({ minimum: 0, maximum: 100000, default: 0 })),
      }),
    },
    ({ user, query }) => ModerationService.suspended(user.id, query.offset),
  )
  .delete("/moderation/suspensions/:id", { auth: true, params: id }, ({ user, params }) =>
    ModerationService.restore(user.id, params.id),
  )
  .patch(
    "/moderation/reports/:id",
    {
      auth: true,
      params: t.Object({ id: t.String({ format: StringFormat.Uuid }) }),
      body: t.Object({
        action: t.Union([
          t.Literal(ReportStatus.Dismissed),
          t.Literal(ReportStatus.Removed),
          t.Literal(ReportStatus.Banned),
        ]),
      }),
    },
    ({ user, params, body }) => ModerationService.resolve(user.id, params.id, body.action),
  );
