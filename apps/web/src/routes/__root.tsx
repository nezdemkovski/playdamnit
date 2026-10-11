import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
  notFoundComponent: NotFound,
});

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="panel mt-10 flex flex-col items-center gap-4 p-16 text-center">
      <div className="text-6xl font-black text-white/20">404</div>
      <p className="text-dimmed">{t("notFound.text")}</p>
      <Button asChild>
        <Link to="/">{t("notFound.back")}</Link>
      </Button>
    </div>
  );
}
