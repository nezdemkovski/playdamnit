import type { Server } from "bun";

import { TooManyRequestsError } from "@/utils/errors";

// In-memory fixed-window limiter. State is per process: with several backend
// instances each one enforces its own budget, which is fine as an abuse guard.

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  check(key: string): void;
}

export const createRateLimiter = (opts: {
  limit: number;
  windowMs: number;
  message?: string;
}): RateLimiter => {
  const windows = new Map<string, Window>();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  }, opts.windowMs);
  cleanup.unref?.();

  return {
    check(key) {
      const now = Date.now();
      let window = windows.get(key);

      if (!window || window.resetAt <= now) {
        window = { count: 0, resetAt: now + opts.windowMs };
        windows.set(key, window);
      }

      window.count++;

      if (window.count > opts.limit) {
        throw new TooManyRequestsError(
          opts.message ?? "Too many requests, slow down",
          Math.ceil((window.resetAt - now) / 1000),
        );
      }
    },
  };
};

const trustProxy = process.env.TRUST_PROXY === "true";

/**
 * Identify the caller: the user id when authenticated, otherwise the client IP.
 * X-Forwarded-For is only honoured with TRUST_PROXY=true, since clients can forge it.
 */
export const clientKey = (
  ctx: { request: Request; server: Server<unknown> | null },
  userId?: string,
): string => {
  if (userId) return `user:${userId}`;

  if (trustProxy) {
    const forwarded = ctx.request.headers.get("x-forwarded-for");
    if (forwarded) return `ip:${forwarded.split(",")[0].trim()}`;
  }

  return `ip:${ctx.server?.requestIP(ctx.request)?.address ?? "unknown"}`;
};
