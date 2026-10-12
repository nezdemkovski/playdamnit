import { useGetApiUserByUsername } from "@playdamnit/api-client";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BookOpenIcon,
  HeartIcon,
  LayersIcon,
  LibraryIcon,
  LinkIcon,
  MessageSquareTextIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";

import { BadgeStrip, computeBadges } from "@/components/profile/badges";
import { HallOfFame } from "@/components/profile/hall-of-fame";
import { ProfileStatStrip } from "@/components/profile/profile-stats";
import { YearInEvenings } from "@/components/profile/year-in-evenings";
import { FollowButton } from "@/components/social/follow-button";
import { SteamBadge } from "@/components/steam/steam-badge";
import { SteamConnectButton } from "@/components/steam/steam-connect";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useLibrary } from "@/hooks/library";
import { format } from "@/i18n/date";
import { DateFormat, FriendsTab, ProfileTab } from "@/lib/enums";

export const Route = createFileRoute("/$username")({
  component: ProfileLayout,
});

const TABS: {
  to: string;
  label: ProfileTab;
  icon: LucideIcon;
  count?: ProfileTab.Games | ProfileTab.Reviews | ProfileTab.Lists;
}[] = [
  { to: "", label: ProfileTab.Profile, icon: UserIcon },
  { to: "/games", label: ProfileTab.Games, icon: LibraryIcon, count: ProfileTab.Games },
  { to: "/journal", label: ProfileTab.Journal, icon: BookOpenIcon },
  {
    to: "/reviews",
    label: ProfileTab.Reviews,
    icon: MessageSquareTextIcon,
    count: ProfileTab.Reviews,
  },
  { to: "/lists", label: ProfileTab.Lists, icon: LayersIcon, count: ProfileTab.Lists },
  { to: "/friends", label: ProfileTab.Friends, icon: UsersIcon },
  { to: "/likes", label: ProfileTab.Likes, icon: HeartIcon },
];

/** Profile header (avatar, bio, links, follow) and the tab bar; tabs render in the outlet */
function ProfileLayout() {
  const { t } = useTranslation();
  const { username } = Route.useParams();
  const profile = useGetApiUserByUsername(username);
  // Badges come from the library; a private one simply shows none
  const library = useLibrary(username);
  const badges = useMemo(
    () =>
      library.data ? computeBadges(library.data.results, profile.data?.counts.reviews ?? 0) : null,
    [library.data, profile.data?.counts.reviews],
  );
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/${username}`;

  if (profile.error) {
    return (
      <div className="panel mt-10 p-16 text-center text-dimmed">
        <Trans
          i18nKey="profile.notFound"
          values={{ username }}
          components={{ n: <span className="font-semibold text-white" /> }}
        />
        <div className="mt-4">
          <Link to="/" className="font-semibold text-white hover:underline">
            {t("notFound.back")}
          </Link>
        </div>
      </div>
    );
  }
  if (profile.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-10 rounded-full" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }
  const user = profile.data;

  return (
    <>
      <header className="panel overflow-hidden">
        <HallOfFame entries={library.data?.results ?? []} />
        <div className="relative -mt-14 px-5 pb-5 sm:-mt-16 sm:px-6 sm:pb-6">
          <div className="flex items-end justify-between gap-4">
            <UserAvatar
              user={user}
              className="size-24 border-2 border-background bg-background sm:size-28"
              textClassName="text-4xl"
            />
            <div className="flex shrink-0 gap-2">
              {user.isOwn ? (
                <>
                  {!user.steamId && <SteamConnectButton size="sm" />}
                  <Button asChild variant="outline" size="sm">
                    <Link to="/$username/settings" params={{ username }}>
                      <SettingsIcon /> {t("profile.editProfile")}
                    </Link>
                  </Button>
                </>
              ) : (
                <FollowButton username={user.username} isFollowing={user.isFollowing} />
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-5">
            <div className="min-w-0">
              {/* Name and the Steam badge side by side on wide screens, stacked on phones; the
                  stats row and the badges below never move */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h1
                      className="min-w-0 truncate text-3xl sm:text-4xl"
                      title={user.name || user.username}
                    >
                      {user.name || user.username}
                    </h1>
                    <span className="num min-w-0 max-w-full truncate text-sm text-dimmed">
                      @{user.username}
                    </span>
                    {user.followsYou && (
                      <span className="eyebrow text-done">{t("profile.followsYou")}</span>
                    )}
                    {!user.listPublic && (
                      <span className="eyebrow">{t("profile.privateList")}</span>
                    )}
                  </div>
                  <div className="eyebrow mt-1">
                    {t("profile.since", {
                      date: format(new Date(user.createdAt), DateFormat.MonthYearShort),
                    })}
                  </div>
                </div>
                {user.steamLinked && (
                  <div className="shrink-0 self-start sm:self-auto">
                    <SteamBadge
                      username={username}
                      isOwn={user.isOwn}
                      name={user.steamName}
                      url={user.steamProfileUrl}
                      avatar={user.steamAvatarUrl}
                      syncedAt={user.steamSyncedAt}
                    />
                  </div>
                )}
              </div>

              {(user.bio || user.links.length > 0) && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {user.bio && (
                    <p className="max-w-2xl text-[15px] text-foreground/85">{user.bio}</p>
                  )}
                  {user.links.map((link) => (
                    <a
                      key={link}
                      href={link}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-sm text-dimmed hover:text-foreground"
                    >
                      <LinkIcon className="size-3.5" />{" "}
                      {new URL(link).hostname.replace(/^www\./, "")}
                    </a>
                  ))}
                </div>
              )}
            </div>
            {library.data && library.data.results.length > 0 && (
              <YearInEvenings username={username} entries={library.data.results} />
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-sm">
            <Link
              to="/$username/friends"
              params={{ username }}
              search={{ tab: FriendsTab.Followers }}
              className="hover:underline"
            >
              <b className="num">{user.counts.followers}</b>{" "}
              <span className="text-dimmed">
                {t("profile.counts.followers", { count: user.counts.followers })}
              </span>
            </Link>
            <Link
              to="/$username/friends"
              params={{ username }}
              search={{ tab: FriendsTab.Following }}
              className="hover:underline"
            >
              <b className="num">{user.counts.following}</b>{" "}
              <span className="text-dimmed">{t("profile.counts.following")}</span>
            </Link>
            {library.data && library.data.results.length > 0 && (
              <ProfileStatStrip entries={library.data.results} own={user.isOwn} />
            )}
            {badges && (
              <div className="sm:ml-auto">
                <BadgeStrip badges={badges} />
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="no-scrollbar mt-4 flex gap-1 overflow-x-auto border-b border-white/5">
        {TABS.map((tab) => {
          const href = base + tab.to;
          const active =
            tab.to === ""
              ? pathname === base || pathname === `${base}/`
              : pathname.startsWith(href);
          const count = tab.count ? user.counts[tab.count] : undefined;
          return (
            <Link
              key={tab.to}
              to={href as "/$username"}
              params={{ username }}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "border-white text-white"
                  : "border-transparent text-dimmed hover:text-white",
              )}
            >
              <tab.icon className="size-4" />
              {t(`profile.tabs.${tab.label}`)}
              {count !== undefined && count > 0 && (
                <span className="text-xs text-dimmed">{count}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        <Outlet />
      </div>
    </>
  );
}
