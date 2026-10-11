import { Link, useRouterState } from "@tanstack/react-router";
import {
  HomeIcon,
  LibraryIcon,
  LogInIcon,
  LogOutIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession, useSignOut } from "@/hooks/auth";

const itemClass = (active: boolean) =>
  cn(
    "flex size-11 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "bg-white/10 text-white" : "text-dimmed hover:bg-white/5 hover:text-white",
  );

function RailItem({
  label,
  icon: Icon,
  active,
  onClick,
  to,
  params,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
  to?: "/" | "/auth" | "/$username" | "/$username/settings";
  params?: Record<string, string>;
}) {
  const content = <Icon className="size-5" strokeWidth={2} />;
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
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

interface SidebarProps {
  onSearch: () => void;
  onAssistant: () => void;
}

/**
 * The icon rail from the reference design: logo, avatar, search and the main sections.
 * Fixed on the left from the md breakpoint, a bottom bar on phones.
 */
export function Sidebar({ onSearch, onAssistant }: SidebarProps) {
  const { user } = useSession();
  const signOut = useSignOut();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const username = user?.username ?? "";
  const profilePath = `/${username}`;

  const items = (
    <>
      <RailItem label="Home" icon={HomeIcon} to="/" active={pathname === "/"} />
      {user ? (
        <>
          <RailItem
            label="My list"
            icon={LibraryIcon}
            to="/$username"
            params={{ username }}
            active={pathname === profilePath}
          />
          <RailItem label="AI assistant" icon={SparklesIcon} onClick={onAssistant} />
          <RailItem
            label="Settings"
            icon={SettingsIcon}
            to="/$username/settings"
            params={{ username }}
            active={pathname === `${profilePath}/settings`}
          />
          <RailItem label="Sign out" icon={LogOutIcon} onClick={() => signOut.mutate()} />
        </>
      ) : (
        <RailItem label="Sign in" icon={LogInIcon} to="/auth" active={pathname === "/auth"} />
      )}
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col items-center gap-2 border-r border-white/5 bg-sidebar py-5 md:flex">
        <Link to="/" className="mb-3 block overflow-hidden rounded-lg" aria-label="PlayDamnIt">
          <img src="/logo.svg" alt="" className="h-8 w-auto" />
        </Link>
        {user && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/$username"
                params={{ username }}
                className="mb-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="size-10 border border-white/30">
                  <AvatarImage src={user.image ?? undefined} alt={user.name} />
                  <AvatarFallback className="bg-[#1c1f21] text-lg font-semibold">
                    {(user.username ?? user.name).slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">@{username}</TooltipContent>
          </Tooltip>
        )}
        <RailItem label="Search" icon={SearchIcon} onClick={onSearch} />
        <nav className="mt-2 flex flex-col items-center gap-1">{items}</nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-white/5 bg-sidebar/95 px-2 py-1.5 backdrop-blur md:hidden">
        <RailItem label="Search" icon={SearchIcon} onClick={onSearch} />
        {items}
      </nav>
    </>
  );
}
