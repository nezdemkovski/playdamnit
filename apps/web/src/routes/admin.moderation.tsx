import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  CheckCheckIcon,
  ExternalLinkIcon,
  LockKeyholeIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  ContentKind,
  ModerationAction,
  ReportStatus,
  useGetApiMe,
  useGetApiModerationReports,
  useGetApiModerationSuspensions,
  patchApiModerationReportsById,
  deleteApiModerationSuspensionsById,
  getGetApiModerationReportsQueryKey,
  getGetApiModerationSuspensionsQueryKey,
  type BlockedUser,
  type ModerationReport,
  type SuspendedUser,
} from "@playdamnit/api-client";
import { useSession } from "@/hooks/auth";
import { relativeDate, shortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/moderation")({ component: ModerationPage });
enum View {
  Queue = "queue",
  History = "history",
  Suspended = "suspended",
}
const PAGE_SIZE = 50;
type Confirmation =
  | { action: ModerationAction.Removed | ModerationAction.Banned; report: ModerationReport }
  | { action: "restore"; member: SuspendedUser };

function ModerationPage() {
  const { t } = useTranslation();
  const { user, isLoading } = useSession();
  const me = useGetApiMe({ query: { enabled: !!user, staleTime: 0 } });
  if (isLoading || (user && me.isPending)) return <Skeleton className="h-64" />;
  if (!user || !me.data?.isModerator)
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <LockKeyholeIcon className="size-8 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{t("moderation.restricted")}</h1>
        {me.isError && user ? (
          <Button variant="outline" onClick={() => me.refetch()}>
            {t("safety.retry")}
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link to={user ? "/" : "/auth"}>{t(user ? "nav.home" : "nav.signIn")}</Link>
          </Button>
        )}
      </div>
    );
  return <ModerationWorkspace />;
}

function Member({ member }: { member?: BlockedUser | null }) {
  const { t } = useTranslation();
  const content = (
    <>
      <UserAvatar user={member ?? {}} className="size-7" />
      <span className="truncate">
        {member?.username
          ? `@${member.username}`
          : (member?.name ?? t("moderation.deletedAccount"))}
      </span>
    </>
  );
  return member?.username ? (
    <Link
      to="/$username"
      params={{ username: member.username }}
      className="flex min-w-0 items-center gap-2 hover:underline"
    >
      {content}
    </Link>
  ) : (
    <span className="flex min-w-0 items-center gap-2">{content}</span>
  );
}

function ModerationWorkspace() {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [view, setView] = useState(View.Queue);
  const [offset, setOffset] = useState(0);
  const [confirming, setConfirming] = useState<Confirmation | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const confirm = (choice: Confirmation) => {
    setConfirming(choice);
    setConfirmationOpen(true);
  };
  const reports = useGetApiModerationReports(
    { resolved: view === View.History, offset },
    { query: { enabled: view !== View.Suspended } },
  );
  const suspended = useGetApiModerationSuspensions(
    { offset },
    { query: { enabled: view === View.Suspended } },
  );
  const current = view === View.Suspended ? suspended : reports;
  const mutation = useMutation({
    mutationFn: (input: { id: string; action: ModerationAction | "restore" }) =>
      input.action === "restore"
        ? deleteApiModerationSuspensionsById(input.id)
        : patchApiModerationReportsById(input.id, { action: input.action }),
    onSuccess: async () => {
      setConfirmationOpen(false);
      setOffset(0);
      await Promise.all([
        cache.invalidateQueries({ queryKey: getGetApiModerationReportsQueryKey() }),
        cache.invalidateQueries({ queryKey: getGetApiModerationSuspensionsQueryKey() }),
      ]);
      toast.success(t("moderation.saved"));
    },
    onError: () => toast.error(t("safety.failed")),
  });
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <ShieldCheckIcon className="size-6 text-muted-foreground" />
          {t("moderation.title")}
        </h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("moderation.refresh")}
          disabled={current.isFetching}
          onClick={() => current.refetch()}
        >
          <RefreshCwIcon />
        </Button>
      </header>
      <Tabs
        value={view}
        onValueChange={(value) => {
          setView(value as View);
          setOffset(0);
        }}
      >
        <TabsList variant="line" className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value={View.Queue}>{t("moderation.queue")}</TabsTrigger>
          <TabsTrigger value={View.History}>{t("moderation.history")}</TabsTrigger>
          <TabsTrigger value={View.Suspended}>{t("moderation.suspended")}</TabsTrigger>
        </TabsList>
        <TabsContent value={view} className="mt-4 flex flex-col gap-6">
          {current.isPending ? (
            <Skeleton className="h-48" />
          ) : current.isError ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-4 border border-border p-5"
            >
              <p>{t("safety.failed")}</p>
              <Button variant="outline" onClick={() => current.refetch()}>
                {t("safety.retry")}
              </Button>
            </div>
          ) : current.data?.length === 0 ? (
            <div
              role="status"
              className="flex flex-col items-center gap-3 border border-border py-20 text-muted-foreground"
            >
              <CheckCheckIcon className="size-9" />
              <p>
                {t(
                  view === View.Queue
                    ? "moderation.emptyQueue"
                    : view === View.History
                      ? "moderation.emptyHistory"
                      : "moderation.emptySuspended",
                )}
              </p>
            </div>
          ) : view === View.Suspended ? (
            <div className="divide-y divide-border border-y border-border">
              {suspended.data?.map((member) => (
                <article
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-5"
                >
                  <div className="flex flex-col gap-2">
                    <Member member={member} />
                    {member.banReason && (
                      <p className="text-sm text-muted-foreground">{member.banReason}</p>
                    )}
                    {member.banExpires && (
                      <time className="text-xs text-muted-foreground" dateTime={member.banExpires}>
                        {t("moderation.until", { date: shortDate(member.banExpires) })}
                      </time>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() => confirm({ action: "restore", member })}
                  >
                    {t("moderation.restore")}
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border border-y border-border">
              {reports.data?.map((report) => (
                <article key={report.id} className="flex flex-col gap-4 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t(`moderation.kind.${report.kind}`)}</Badge>
                      <span className="text-sm font-semibold">{t(`safety.${report.reason}`)}</span>
                      {report.status !== ReportStatus.Pending && (
                        <Badge variant="secondary">{t(`moderation.status.${report.status}`)}</Badge>
                      )}
                    </div>
                    <time
                      className="text-xs text-muted-foreground"
                      dateTime={report.createdAt}
                      title={new Date(report.createdAt).toLocaleString()}
                    >
                      {relativeDate(report.createdAt)}
                    </time>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                    <Member member={report.subject} />
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                      {t("moderation.reportedBy")}
                      <Member member={report.reporter} />
                    </span>
                    {report.kind === ContentKind.List &&
                      report.status !== ReportStatus.Removed &&
                      report.status !== ReportStatus.Banned && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link to="/lists/$id" params={{ id: report.targetId }}>
                            {t("moderation.openContent")}
                            <ExternalLinkIcon data-icon="inline-end" />
                          </Link>
                        </Button>
                      )}
                  </div>
                  <blockquote className="max-h-72 overflow-y-auto border-l-2 border-border py-1 pl-4 whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {report.context}
                  </blockquote>
                  {report.status === ReportStatus.Pending ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mutation.isPending}
                        onClick={() =>
                          mutation.mutate({ id: report.id, action: ModerationAction.Dismissed })
                        }
                      >
                        {t("safety.dismiss")}
                      </Button>
                      {report.kind !== ContentKind.User && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={mutation.isPending}
                          onClick={() => confirm({ action: ModerationAction.Removed, report })}
                        >
                          {t("safety.remove")}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={mutation.isPending}
                        onClick={() => confirm({ action: ModerationAction.Banned, report })}
                      >
                        {t("safety.ban")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {t("moderation.resolvedBy")}
                      <Member member={report.resolver} />
                      {report.resolvedAt && (
                        <time dateTime={report.resolvedAt}>{shortDate(report.resolvedAt)}</time>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
          {!current.isPending &&
            !current.isError &&
            (offset > 0 || current.data?.length === PAGE_SIZE) && (
              <nav
                aria-label={t("moderation.pagination")}
                className="flex items-center justify-between gap-4"
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0 || current.isFetching}
                  onClick={() => setOffset((n) => Math.max(0, n - PAGE_SIZE))}
                >
                  {t("moderation.previous")}
                </Button>
                <span className="num text-sm text-muted-foreground">
                  {offset + 1}–{offset + (current.data?.length ?? 0)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={current.data?.length !== PAGE_SIZE || current.isFetching}
                  onClick={() => setOffset((n) => n + PAGE_SIZE)}
                >
                  {t("moderation.next")}
                </Button>
              </nav>
            )}
        </TabsContent>
      </Tabs>
      <AlertDialog
        open={confirmationOpen}
        onOpenChange={(open) => {
          if (!mutation.isPending) setConfirmationOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                confirming?.action === "restore"
                  ? "moderation.restore"
                  : confirming?.action === ModerationAction.Removed
                    ? "safety.remove"
                    : "safety.ban",
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                confirming?.action === "restore"
                  ? "moderation.restoreText"
                  : confirming?.action === ModerationAction.Removed
                    ? "moderation.removeText"
                    : "safety.banText",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant={confirming?.action === "restore" ? "default" : "destructive"}
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (confirming)
                  mutation.mutate({
                    id:
                      confirming.action === "restore" ? confirming.member.id : confirming.report.id,
                    action: confirming.action,
                  });
              }}
            >
              {t(
                confirming?.action === "restore"
                  ? "moderation.restore"
                  : confirming?.action === ModerationAction.Removed
                    ? "safety.remove"
                    : "safety.ban",
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
