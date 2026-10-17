import { Elysia } from "elysia";

import { DemoService } from "@/modules/demo/service";
import { HttpHeader, MimeType } from "@/utils/enums";
import { clientKey, createRateLimiter } from "@/utils/rateLimit";

// A visitor taps "Try the demo" once or twice; a loop making sessions is not a visitor
const limiter = createRateLimiter({
  limit: 10,
  windowMs: 10 * 60 * 1000,
  message: "Too many demo sessions, try again later",
});

/** Signs the caller into the shared read-only demo account, setting the session cookie */
export const demoRoutes = new Elysia().post("/demo/session", async (ctx) => {
  limiter.check(clientKey(ctx));
  const { cookies } = await DemoService.signIn();
  const headers = new Headers({ [HttpHeader.ContentType]: MimeType.Json });
  for (const cookie of cookies) headers.append(HttpHeader.SetCookie, cookie);
  return new Response(JSON.stringify({ ok: true }), { headers });
});
