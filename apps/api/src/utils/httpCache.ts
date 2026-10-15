import { Elysia } from "elysia";

import {
  CacheControl,
  ContentEncoding,
  HttpHeader,
  HttpMethod,
  MimeType,
  RoutePath,
} from "@/utils/enums";

// Smaller bodies gain nothing from gzip. A whole library index (600 games) goes from 316 KB to
// 32 KB in under a millisecond.
const GZIP_MIN_BYTES = 1024;
const GZIP_LEVEL = 6;

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
 * are public for an hour; everything else is private and revalidated on every reuse. Bodies
 * go out gzipped to clients that accept it (URLSession and browsers do).
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
    headers[HttpHeader.ContentType] = MimeType.Json;
    headers[HttpHeader.Vary] = HttpHeader.AcceptEncoding;
    const gzip =
      body.length >= GZIP_MIN_BYTES &&
      (request.headers.get(HttpHeader.AcceptEncoding) ?? "").includes(ContentEncoding.Gzip);
    if (!gzip) return new Response(body, { status: 200, headers });
    return new Response(Bun.gzipSync(body, { level: GZIP_LEVEL }), {
      status: 200,
      headers: { ...headers, [HttpHeader.ContentEncoding]: ContentEncoding.Gzip },
    });
  },
);
