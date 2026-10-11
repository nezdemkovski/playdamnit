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
import { FollowButton } from "@/components/social/follow-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useLibrary } from "@/hooks/library";
import { FriendsTab, ProfileTab } from "@/lib/enums";

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
      <header className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <UserAvatar user={user} className="size-20 sm:size-24" textClassName="text-3xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="truncate text-2xl font-bold">{user.name || user.username}</h1>
              <span className="text-sm text-dimmed">@{user.username}</span>
              {user.followsYou && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                  {t("profile.followsYou")}
                </span>
              )}
              {!user.listPublic && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                  {t("profile.privateList")}
                </span>
              )}
            </div>
            {user.bio && <p className="mt-2 max-w-2xl text-sm text-white/80">{user.bio}</p>}
            {user.links.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {user.links.map((link) => (
                  <a
                    key={link}
                    href={link}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-dimmed hover:text-white"
                  >
                    <LinkIcon className="size-3" /> {new URL(link).hostname.replace(/^www\./, "")}
                  </a>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>
                <b>{user.counts.games}</b>{" "}
                <span className="text-dimmed">
                  {t("profile.counts.games", { count: user.counts.games })}
                </span>
              </span>
              <Link
                to="/$username/friends"
                params={{ username }}
                search={{ tab: FriendsTab.Followers }}
                className="hover:underline"
              >
                <b>{user.counts.followers}</b>{" "}
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
                <b>{user.counts.following}</b>{" "}
                <span className="text-dimmed">{t("profile.counts.following")}</span>
              </Link>
            </div>
            {badges && (
              <div className="mt-3">
                <BadgeStrip badges={badges} />
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {user.isOwn ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/$username/settings" params={{ username }}>
                  <SettingsIcon /> {t("profile.editProfile")}
                </Link>
              </Button>
            ) : (
              <FollowButton username={user.username} isFollowing={user.isFollowing} />
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
