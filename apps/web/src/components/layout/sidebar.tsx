import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3Icon,
  BellIcon,
  CalendarDaysIcon,
  HomeIcon,
  LibraryIcon,
  LogInIcon,
  LogOutIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { useSession, useSignOut } from "@/hooks/auth";
import { useUnreadNotifications } from "@/hooks/social";
import { RoutePath } from "@/lib/enums";

type To =
  | "/"
  | "/auth"
  | "/calendar"
  | "/charts"
  | "/community"
  | "/notifications"
  | "/$username"
  | "/$username/settings";

const itemClass = (active: boolean) =>
  cn(
    "relative flex items-center gap-3 border-l-2 border-transparent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
    "size-11 justify-center xl:h-11 xl:w-full xl:justify-start xl:px-4",
    active
      ? "border-signal bg-gradient-to-r from-signal/15 to-transparent text-white"
      : "text-dimmed hover:bg-white/5 hover:text-white",
  );

function RailItem({
  label,
  icon: Icon,
  active,
  onClick,
  to,
  params,
  badge,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
  to?: To;
  params?: Record<string, string>;
  badge?: number;
}) {
  const content = (
    <>
      <Icon className="size-5 shrink-0" strokeWidth={2} />
      <span className="hidden text-sm font-semibold xl:inline">{label}</span>
      {badge ? (
        <span className="num absolute top-1.5 right-1.5 min-w-4 bg-signal px-1 text-center text-[10px] font-extrabold leading-4 text-black xl:static xl:ml-auto">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {to ? (
          <Link to={to} params={params} className={itemClass(!!active)} aria-label={label}>
            {content}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onClick}
            className={itemClass(!!active)}
            aria-label={label}
          >
            {content}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="right" className="xl:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

interface SidebarProps {
  onSearch: () => void;
  onAssistant: () => void;
}

/**
 * The icon rail from the reference design: logo, avatar, search and the main sections. Icons
 * only from md, icons with labels from xl, a bottom bar on phones.
 */
export function Sidebar({ onSearch, onAssistant }: SidebarProps) {
  const { t } = useTranslation();
  const { user } = useSession();
  const signOut = useSignOut();
  const unread = useUnreadNotifications(!!user);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const username = user?.username ?? "";
  const profilePath = `/${username}`;
  const is = (path: string) => pathname === path;

  const common = (
    <>
      <RailItem label={t("nav.home")} icon={HomeIcon} to="/" active={is("/")} />
      <RailItem
        label={t("nav.calendar")}
        icon={CalendarDaysIcon}
        to="/calendar"
        active={pathname.startsWith(RoutePath.Calendar)}
      />
      <RailItem
        label={t("nav.charts")}
        icon={BarChart3Icon}
        to="/charts"
        active={pathname.startsWith(RoutePath.Charts)}
      />
      <RailItem
        label={t("nav.community")}
        icon={UsersIcon}
        to="/community"
        active={pathname.startsWith(RoutePath.Community)}
      />
    </>
  );

  const rail = user ? (
    <>
      {common}
      <RailItem
        label={t("nav.myGames")}
        icon={LibraryIcon}
        to="/$username"
        params={{ username }}
        active={pathname.startsWith(profilePath) && !is(`${profilePath}/settings`)}
      />
      <RailItem
        label={t("nav.notifications")}
        icon={BellIcon}
        to="/notifications"
        active={is("/notifications")}
        badge={unread}
      />
      <RailItem label={t("nav.aiAssistant")} icon={SparklesIcon} onClick={onAssistant} />
      <RailItem
        label={t("nav.settings")}
        icon={SettingsIcon}
        to="/$username/settings"
        params={{ username }}
        active={is(`${profilePath}/settings`)}
      />
      <RailItem label={t("nav.signOut")} icon={LogOutIcon} onClick={() => signOut.mutate()} />
    </>
  ) : (
    <>
      {common}
      <RailItem label={t("nav.signIn")} icon={LogInIcon} to="/auth" active={is("/auth")} />
    </>
  );

  const mobile = user ? (
    <>
      <RailItem label={t("nav.home")} icon={HomeIcon} to="/" active={is("/")} />
      <RailItem
        label={t("nav.charts")}
        icon={BarChart3Icon}
        to="/charts"
        active={pathname.startsWith(RoutePath.Charts)}
      />
      <RailItem
        label={t("nav.myGames")}
        icon={LibraryIcon}
        to="/$username"
        params={{ username }}
        active={pathname.startsWith(profilePath)}
      />
      <RailItem
        label={t("nav.notifications")}
        icon={BellIcon}
        to="/notifications"
        active={is("/notifications")}
        badge={unread}
      />
      <RailItem
        label={t("nav.community")}
        icon={UsersIcon}
        to="/community"
        active={pathname.startsWith(RoutePath.Community)}
      />
    </>
  ) : (
    <>
      <RailItem label={t("nav.home")} icon={HomeIcon} to="/" active={is("/")} />
      <RailItem
        label={t("nav.charts")}
        icon={BarChart3Icon}
        to="/charts"
        active={pathname.startsWith(RoutePath.Charts)}
      />
      <RailItem
        label={t("nav.calendar")}
        icon={CalendarDaysIcon}
        to="/calendar"
        active={pathname.startsWith(RoutePath.Calendar)}
      />
      <RailItem label={t("nav.signIn")} icon={LogInIcon} to="/auth" active={is("/auth")} />
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col items-center gap-2 border-r border-white/5 bg-sidebar px-3 py-5 md:flex xl:w-60 xl:items-stretch">
        <Link
          to="/"
          className="mb-3 block self-center xl:self-start xl:px-1"
          aria-label={t("app.name")}
        >
          <img src="/logo.svg" alt="" className="size-9" />
        </Link>
        {user && (
          <Link
            to="/$username"
            params={{ username }}
            className="mb-1 flex items-center gap-3 self-center outline-none focus-visible:ring-2 focus-visible:ring-ring xl:self-stretch xl:px-1"
          >
            <UserAvatar user={user} className="size-10" textClassName="text-lg" />
            <span className="hidden min-w-0 xl:block">
              <span className="block truncate text-sm font-bold">{user.name || username}</span>
              <span className="num block truncate text-[11px] text-dimmed">@{username}</span>
            </span>
          </Link>
        )}
        <RailItem label={t("nav.search")} icon={SearchIcon} onClick={onSearch} />
        <nav className="mt-2 flex flex-col items-center gap-1 xl:items-stretch">{rail}</nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-white/5 bg-sidebar/95 px-2 py-1.5 backdrop-blur md:hidden">
        <RailItem label={t("nav.search")} icon={SearchIcon} onClick={onSearch} />
        {mobile}
      </nav>
    </>
  );
}
