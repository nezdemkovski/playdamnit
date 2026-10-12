import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { UserService } from "@/modules/user/service";

export const meRoutes = new Elysia()
  .use(betterAuth)
  .get("/me", { auth: true }, ({ user }) => UserService.findById(user.id))
  .patch(
    "/me",
    {
      auth: true,
      body: t.Object({
        bio: t.Optional(t.Nullable(t.String({ maxLength: 300 }))),
        links: t.Optional(t.Array(t.String({ maxLength: 200 }), { maxItems: 5 })),
        listPublic: t.Optional(t.Boolean()),
      }),
    },
    ({ user, body }) => UserService.updateProfile(user.id, body),
  )
  .get(
    "/me/notifications",
    {
      auth: true,
      query: t.Object({ limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 30 })) }),
    },
    ({ user, query }) => UserService.notifications(user.id, { limit: query.limit ?? 30 }),
  )
  .get("/me/notifications/unread", { auth: true }, ({ user }) =>
    UserService.unreadNotifications(user.id),
  )
  .post("/me/notifications/read", { auth: true }, ({ user }) =>
    UserService.markNotificationsRead(user.id),
  )
  .get(
    "/me/feed",
    {
      auth: true,
      query: t.Object({
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 40 })),
        offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
      }),
    },
    ({ user, query }) =>
      UserService.feed(user.id, { limit: query.limit ?? 40, offset: query.offset ?? 0 }),
  )
  .post(
    "/me/avatar",
    { auth: true, body: t.Object({ file: t.File({ maxSize: "2m" }) }) },
    ({ user, body }) => UserService.setAvatar(user.id, body.file),
  )
  .delete("/me/avatar", { auth: true }, ({ user }) => UserService.clearAvatar(user.id));
