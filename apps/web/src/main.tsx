import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";

import { configureApiClient } from "@playdamnit/api-client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { getConfig } from "@/config";
import { queryClient } from "@/lib/query-client";
import Providers from "@/providers";
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
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>
);
