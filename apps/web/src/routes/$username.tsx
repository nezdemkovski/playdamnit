import { createFileRoute, Outlet } from "@tanstack/react-router";

import Sidebar from "@/components/sidebar/sidebar";

export const Route = createFileRoute("/$username")({
  component: UserLayout,
});

function UserLayout() {
  return (
    <div className="min-h-screen bg-playdamnit-darker text-playdamnit-light">
      <div className="flex">
        <div className="fixed h-screen">
          <Sidebar />
        </div>
        <div className="flex-1 ml-20 md:ml-64">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
