import { GetApiUsersSort, useGetApiUsers } from "@playdamnit/api-client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Gamepad2Icon, SearchIcon, UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { FollowButton } from "@/components/social/follow-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { SteamFriends } from "@/components/steam/steam-friends";
import { useSession } from "@/hooks/auth";

const PAGE = 30;

export const Route = createFileRoute("/community")({
  validateSearch: (raw: Record<string, unknown>) => ({
    q: typeof raw.q === "string" ? raw.q : "",
    sort: (Object.values<unknown>(GetApiUsersSort).includes(raw.sort)
      ? raw.sort
      : GetApiUsersSort.Games) as GetApiUsersSort,
    page: typeof raw.page === "number" && raw.page > 0 ? raw.page : 1,
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const { user } = useSession();
  const navigate = useNavigate({ from: "/community" });
  const [input, setInput] = useState(search.q);
  useEffect(() => setInput(search.q), [search.q]);

  const query = useGetApiUsers(
    { q: search.q || undefined, sort: search.sort, limit: PAGE, offset: (search.page - 1) * PAGE },
    { query: { placeholderData: (prev) => prev } },
  );
  const total = query.data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {t("community.title")}{" "}
          <span className="text-sm font-semibold text-dimmed">{query.data ? total : ""}</span>
        </h1>
        <Select
          value={search.sort}
          onValueChange={(v) =>
            navigate({ search: { ...search, sort: v as GetApiUsersSort, page: 1 } })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GetApiUsersSort.Games}>{t("community.sortGames")}</SelectItem>
            <SelectItem value={GetApiUsersSort.Followers}>
              {t("community.sortFollowers")}
            </SelectItem>
            <SelectItem value={GetApiUsersSort.Newest}>{t("community.sortNewest")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <form
        className="relative mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ search: { ...search, q: input.trim(), page: 1 } });
        }}
      >
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-dimmed" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("community.searchPlaceholder")}
          className="h-11 rounded-full pl-11"
        />
      </form>

      <SteamFriends enabled={!!user} />

      <div className="mt-6 space-y-2">
        {query.isPending
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 rounded-card" />)
          : query.data?.results.map((member) => (
              <div key={member.id} className="panel flex items-center gap-4 p-3 sm:p-4">
                <Link to="/$username" params={{ username: member.username ?? "" }}>
                  <UserAvatar user={member} className="size-12" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/$username"
                    params={{ username: member.username ?? "" }}
                    className="font-bold hover:underline"
                  >
                    {member.name || member.username}
                  </Link>
                  <span className="ml-2 text-xs text-dimmed">@{member.username}</span>
                  {member.bio && <p className="truncate text-sm text-white/70">{member.bio}</p>}
                </div>
                <div className="hidden items-center gap-4 text-sm text-dimmed sm:flex">
                  <span className="flex items-center gap-1">
                    <Gamepad2Icon className="size-4" /> {member.gamesCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <UsersIcon className="size-4" /> {member.followersCount}
                  </span>
                </div>
                <FollowButton username={member.username ?? ""} isFollowing={member.isFollowing} />
              </div>
            ))}
        {query.data?.results.length === 0 && (
          <div className="panel p-12 text-center text-dimmed">{t("community.empty")}</div>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={search.page <= 1}
            onClick={() => navigate({ search: { ...search, page: search.page - 1 } })}
          >
            {t("common.previous")}
          </Button>
          <span className="text-dimmed">{t("common.pageOf", { page: search.page, pages })}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={search.page >= pages}
            onClick={() => navigate({ search: { ...search, page: search.page + 1 } })}
          >
            {t("common.next")}
          </Button>
        </div>
      )}
    </>
  );
}
