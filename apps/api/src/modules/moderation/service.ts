import { and, asc, desc, eq, getTableColumns, gt, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/postgres";
import {
  contentReport,
  userBlock,
  user,
  userFollows,
  notification,
  userGames,
  gameList,
  reviewReaction,
  session,
} from "@playdamnit/db/schema";
import { ContentKind, MemberRole, ReportReason, ReportStatus } from "@playdamnit/db/enums";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/utils/errors";
import { requireVisibleAuthor } from "./visibility";

export abstract class ModerationService {
  static async report(
    reporterId: string,
    input: { kind: ContentKind; targetId: string; reason: ReportReason },
  ) {
    if (
      input.kind !== ContentKind.User &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.targetId)
    )
      throw new BadRequestError("Invalid content ID");
    let subjectId: string, context: string;
    if (input.kind === ContentKind.User) {
      const row = await db.query.user.findFirst({
        where: { id: input.targetId },
        columns: { id: true, username: true, name: true, bio: true },
      });
      if (!row) throw new NotFoundError("User not found");
      subjectId = row.id;
      context = `${row.username}: ${row.name}\n${row.bio ?? ""}`;
    } else if (input.kind === ContentKind.Review) {
      const row = await db.query.userGames.findFirst({
        where: { id: input.targetId, review: { isNotNull: true } },
        with: { user: { columns: { listPublic: true } } },
      });
      if (!row || (!row.user.listPublic && row.userId !== reporterId))
        throw new NotFoundError("Review not found");
      subjectId = row.userId;
      context = row.review!;
    } else {
      const row = await db.query.gameList.findFirst({ where: { id: input.targetId } });
      if (!row || (!row.isPublic && row.userId !== reporterId))
        throw new NotFoundError("List not found");
      subjectId = row.userId;
      context = `${row.name}\n${row.description ?? ""}`;
    }
    if (subjectId === reporterId) throw new BadRequestError("You cannot report your own content");
    await requireVisibleAuthor(subjectId, reporterId);
    await db
      .insert(contentReport)
      .values({ ...input, reporterId, subjectId, context: context.slice(0, 2000) })
      .onConflictDoNothing();
    return { ok: true };
  }
  static async blocks(userId: string) {
    return db
      .select({
        id: user.id,
        username: user.username,
        name: user.name,
        image: user.image,
        steamAvatarUrl: user.steamAvatarUrl,
      })
      .from(userBlock)
      .innerJoin(user, eq(user.id, userBlock.blockedId))
      .where(eq(userBlock.blockerId, userId))
      .orderBy(userBlock.createdAt);
  }
  static async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) throw new BadRequestError("You cannot block yourself");
    if (!(await db.query.user.findFirst({ where: { id: blockedId }, columns: { id: true } })))
      throw new NotFoundError("User not found");
    await db.transaction(async (tx) => {
      await tx.insert(userBlock).values({ blockerId, blockedId }).onConflictDoNothing();
      await tx
        .delete(userFollows)
        .where(
          or(
            and(eq(userFollows.followerId, blockerId), eq(userFollows.followingId, blockedId)),
            and(eq(userFollows.followerId, blockedId), eq(userFollows.followingId, blockerId)),
          ),
        );
      await tx
        .delete(notification)
        .where(
          or(
            and(eq(notification.userId, blockerId), eq(notification.actorId, blockedId)),
            and(eq(notification.userId, blockedId), eq(notification.actorId, blockerId)),
          ),
        );
    });
    return { ok: true };
  }
  static async unblock(blockerId: string, blockedId: string) {
    await db
      .delete(userBlock)
      .where(and(eq(userBlock.blockerId, blockerId), eq(userBlock.blockedId, blockedId)));
    return { ok: true };
  }
  // Never trust a cached role or a client-supplied moderator ID.
  static async requireModerator(id: string) {
    const row = await db.query.user.findFirst({
      where: { id },
      columns: { role: true, banned: true },
    });
    if (row?.role !== MemberRole.Admin || row.banned) throw new ForbiddenError();
  }
  static async queue(id: string, resolved = false, offset = 0) {
    await this.requireModerator(id);
    const subject = alias(user, "report_subject");
    const reporter = alias(user, "report_reporter");
    const resolver = alias(user, "report_resolver");
    const member = (table: typeof subject | typeof reporter | typeof resolver) => ({
      id: table.id,
      username: table.username,
      name: table.name,
      image: table.image,
      steamAvatarUrl: table.steamAvatarUrl,
    });
    return db
      .select({
        ...getTableColumns(contentReport),
        subject: member(subject),
        reporter: member(reporter),
        resolver: member(resolver),
      })
      .from(contentReport)
      .leftJoin(subject, eq(contentReport.subjectId, subject.id))
      .leftJoin(reporter, eq(contentReport.reporterId, reporter.id))
      .leftJoin(resolver, eq(contentReport.resolvedBy, resolver.id))
      .where(
        resolved
          ? ne(contentReport.status, ReportStatus.Pending)
          : eq(contentReport.status, ReportStatus.Pending),
      )
      .orderBy(
        resolved ? desc(contentReport.resolvedAt) : asc(contentReport.createdAt),
        contentReport.id,
      )
      .limit(50)
      .offset(offset);
  }
  static async suspended(id: string, offset = 0) {
    await this.requireModerator(id);
    return db
      .select({
        id: user.id,
        username: user.username,
        name: user.name,
        image: user.image,
        steamAvatarUrl: user.steamAvatarUrl,
        banReason: user.banReason,
        banExpires: user.banExpires,
      })
      .from(user)
      .where(
        and(eq(user.banned, true), or(isNull(user.banExpires), gt(user.banExpires, new Date()))),
      )
      .orderBy(user.id)
      .limit(50)
      .offset(offset);
  }
  static async restore(id: string, subjectId: string) {
    await this.requireModerator(id);
    const [restored] = await db
      .update(user)
      .set({ banned: false, banReason: null, banExpires: null })
      .where(eq(user.id, subjectId))
      .returning({ id: user.id });
    if (!restored) throw new NotFoundError("User not found");
    // Old sessions remain revoked; the member must sign in again.
    return { ok: true };
  }
  static async resolve(
    id: string,
    reportId: string,
    action: Exclude<ReportStatus, ReportStatus.Pending>,
  ) {
    await this.requireModerator(id);
    await db.transaction(async (tx) => {
      const [report] = await tx
        .select()
        .from(contentReport)
        .where(eq(contentReport.id, reportId))
        .for("update");
      if (!report) throw new NotFoundError("Report not found");
      if (report.status !== ReportStatus.Pending) return;
      if (action === ReportStatus.Banned && report.subjectId) {
        const target = await tx.query.user.findFirst({
          where: { id: report.subjectId },
          columns: { role: true },
        });
        if (target?.role === MemberRole.Admin)
          throw new ForbiddenError("Cannot ban an administrator");
        await tx
          .update(user)
          .set({ banned: true, banReason: "Community rules", banExpires: null })
          .where(eq(user.id, report.subjectId));
        await tx.delete(session).where(eq(session.userId, report.subjectId));
      }
      if (action === ReportStatus.Removed) {
        if (report.kind === ContentKind.User)
          throw new BadRequestError("Use account suspension for a profile");
        if (report.kind === ContentKind.Review) {
          await tx.update(userGames).set({ review: null }).where(eq(userGames.id, report.targetId));
          await tx.delete(reviewReaction).where(eq(reviewReaction.userGameId, report.targetId));
        } else await tx.delete(gameList).where(eq(gameList.id, report.targetId));
      }
      await tx
        .update(contentReport)
        .set({ status: action, resolvedAt: new Date(), resolvedBy: id })
        .where(eq(contentReport.id, reportId));
    });
    return { ok: true };
  }
}
