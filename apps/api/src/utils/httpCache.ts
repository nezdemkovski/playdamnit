import { Elysia } from "elysia";

import { CacheControl, HttpHeader, HttpMethod, MimeType, RoutePath } from "@/utils/enums";

/** Plain JSON a handler returned (not a Response, a file or an error status) */
const isJsonValue = (value: unknown): value is object =>
  Array.isArray(value) ||
  (typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype);

/**
 * Successful JSON GETs get a weak ETag of their body, and a request that already holds that
 * version (If-None-Match) gets an empty 304: the client reuses what it has, which on a phone
 * saves the whole download. URLSession and browsers send the header on their own. The lookups
 * are public for an hour; everything else is private and revalidated on every reuse.
 */
export const httpCache = new Elysia({ name: "http-cache" }).mapResponse(
  "global",
  ({ request, responseValue, set }) => {
    if (request.method !== HttpMethod.Get) return;
    if (set.status !== undefined && set.status !== 200) return;
    if (!isJsonValue(responseValue)) return;

    const body = JSON.stringify(responseValue);
    const etag = `W/"${Bun.hash(body).toString(36)}"`;
    const path = new URL(request.url).pathname;
    const headers: Record<string, string> = {
      ...(set.headers as Record<string, string>),
      [HttpHeader.ETag]: etag,
      [HttpHeader.CacheControl]:
        (set.headers[HttpHeader.CacheControl] as string | undefined) ??
        (path === RoutePath.Catalog ? CacheControl.Catalog : CacheControl.Revalidate),
    };

    if (request.headers.get(HttpHeader.IfNoneMatch) === etag) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(body, {
      status: 200,
      headers: { ...headers, [HttpHeader.ContentType]: MimeType.Json },
    });
  },
);
