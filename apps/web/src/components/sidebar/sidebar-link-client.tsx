import { Link } from "@tanstack/react-router";
import { Home, Gamepad2, Settings, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

export type NavigationItem = {
  name: string;
  iconName: string;
  description: string;
} & (
  | { to: "/"; params?: undefined }
  | { to: "/$username" | "/$username/settings"; params: { username: string } }
);

const renderIcon = (iconName: string) => {
  switch (iconName) {
    case "Home":
      return <Home className="w-5 h-5" />;
    case "Gamepad2":
      return <Gamepad2 className="w-5 h-5" />;
    case "Settings":
      return <Settings className="w-5 h-5" />;
    default:
      return <Circle className="w-5 h-5" />;
  }
};

const SidebarLink = ({ item }: { item: NavigationItem }) => {
  return (
    // Exact match: "My Games" must not stay highlighted on the settings page
    <Link
      to={item.to}
      params={item.params as never}
      activeOptions={{ exact: true }}
    >
      {({ isActive }) => (
        <div
          className={cn(
            "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative overflow-hidden",
            isActive
              ? "text-playdamnit-cyan bg-playdamnit-purple/10 border-l-2 border-playdamnit-cyan"
              : "text-playdamnit-light/60 hover:text-playdamnit-light hover:bg-playdamnit-purple/5"
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
              isActive
                ? "bg-playdamnit-purple/20 text-playdamnit-cyan"
                : "text-playdamnit-light/40 group-hover:text-playdamnit-cyan"
            )}
          >
            {renderIcon(item.iconName)}
          </div>
          <span className="hidden md:block">{item.name}</span>

          <div className="absolute left-full ml-2 px-2 py-1 bg-playdamnit-dark text-playdamnit-light text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 md:hidden">
            {item.name}
          </div>
        </div>
      )}
    </Link>
  );
};

export default SidebarLink;
