import { Elysia, t } from "elysia";

import { betterAuth } from "@/lib/betterAuth";
import { setFirstPassword, signInMethods } from "@/modules/user/signIn";

/** The member's sign-in methods for settings, and a first password for an account without one */
export const signInRoutes = new Elysia()
  .use(betterAuth)
  .get("/me/sign-in", { auth: true }, ({ user }) => signInMethods(user.id))
  .post(
    "/me/password",
    { auth: true, body: t.Object({ newPassword: t.String({ minLength: 8, maxLength: 128 }) }) },
    async ({ request, body }) => {
      await setFirstPassword(request.headers, body.newPassword);
      return { status: true };
    },
  );
