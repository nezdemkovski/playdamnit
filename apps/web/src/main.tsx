import "@fontsource-variable/archivo";
import "@fontsource/archivo-black";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

import { configureApiClient } from "@playdamnit/api-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { getConfig } from "@/config";
import { queryClient } from "@/lib/query-client";
import { routeTree } from "./routeTree.gen";

configureApiClient({ baseURL: getConfig().apiUrl });

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <RouterProvider router={router} />
      </TooltipProvider>
      <Toaster position="bottom-center" theme="dark" />
    </QueryClientProvider>
  </StrictMode>,
);
