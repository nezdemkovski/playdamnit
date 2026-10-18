import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db/postgres";
import { user, userBlock } from "@playdamnit/db/schema";
import { NotFoundError } from "@/utils/errors";

/** Indexed, correlated predicate shared by profiles, feeds, lists and notifications. */
export const visibleAuthor = (author: unknown, viewer: string | null): SQL => sql`
  exists (select 1 from ${user} safety_author where safety_author.id = ${author}
    and (safety_author.banned is not true or safety_author.ban_expires <= now()))
  ${
    viewer
      ? sql`and not exists (select 1 from ${userBlock} b where
    (b.blocker_id = ${viewer} and b.blocked_id = ${author}) or
    (b.blocked_id = ${viewer} and b.blocker_id = ${author}))`
      : sql``
  }`;

export async function requireVisibleAuthor(author: string, viewer: string | null) {
  const row = await db.query.user.findFirst({
    where: { id: author, RAW: (t) => visibleAuthor(t.id, viewer) },
    columns: { id: true },
  });
  if (!row) throw new NotFoundError("User not found");
}
