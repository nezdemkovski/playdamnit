import "@fontsource-variable/archivo";
import "@fontsource/archivo-black";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import "@/i18n";

import { configureApiClient } from "@playdamnit/api-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";

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

// Text produced outside React (voice lines, formatters) reads the active language when it is
// called, so a language change remounts the tree to refresh it all at once
function App() {
  const { i18n } = useTranslation();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200} key={i18n.language}>
        <RouterProvider router={router} />
      </TooltipProvider>
      <Toaster position="bottom-center" theme="dark" />
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
