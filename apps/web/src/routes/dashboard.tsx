import { createFileRoute } from "@tanstack/react-router";

import DashboardClient from "@/components/dashboard/DashboardClient";
import { Suspense } from "react";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="skeleton-container">
          <div className="skeleton-button-container">
            <div className="skeleton-button"></div>
          </div>
          <div className="skeleton-greeting"></div>
          <div className="skeleton-button"></div>
        </div>
      }
    >
      <DashboardClient />
    </Suspense>
  );
}
