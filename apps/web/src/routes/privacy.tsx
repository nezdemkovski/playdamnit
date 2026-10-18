import { createFileRoute } from "@tanstack/react-router";

import { LegalPage } from "@/components/legal-page";
import { LegalDocument } from "@/lib/enums";

export const Route = createFileRoute("/privacy")({
  component: () => <LegalPage document={LegalDocument.Privacy} />,
});
