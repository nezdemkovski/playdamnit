import { useSession } from "@/hooks/auth";
import SidebarLink, { type NavigationItem } from "./sidebar-link-client";
import { UserSection, AddGameButton, GameAssistantButton } from "./sidebar-client";

const Sidebar = () => {
  const { user } = useSession();

  const navigation: NavigationItem[] = [
    { name: "Home", to: "/", iconName: "Home", description: "Dashboard" },
    ...(user?.username
      ? ([
          {
            name: "My Games",
            to: "/$username",
            params: { username: user.username },
            iconName: "Gamepad2",
            description: "Your collection",
          },
          {
            name: "Settings",
            to: "/$username/settings",
            params: { username: user.username },
            iconName: "Settings",
            description: "Preferences",
          },
        ] satisfies NavigationItem[])
      : []),
  ];

  return (
    <div className="w-20 md:w-64 border-r border-playdamnit-purple/10 bg-playdamnit-darker/50 flex flex-col h-screen sticky top-0">
      <div className="px-3 py-6 flex-1 overflow-y-auto scrollbar-hide">
        <nav className="space-y-1.5">
          {navigation.map((item) => (
            <SidebarLink key={item.name} item={item} />
          ))}
        </nav>
      </div>

      <div className="mt-auto">
        <AddGameButton />
        <GameAssistantButton />
        <UserSection user={user} />
      </div>
    </div>
  );
};

export default Sidebar;
