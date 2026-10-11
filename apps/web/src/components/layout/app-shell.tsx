import { lazy, Suspense, useEffect, useState } from "react";

import { Footer } from "./footer";
import { SearchDialog } from "./search-dialog";
import { Sidebar } from "./sidebar";

// The assistant pulls in the AI SDK; load it only when opened
const AssistantDialog = lazy(() =>
  import("@/components/assistant-dialog").then((m) => ({ default: m.AssistantDialog })),
);

/** Page frame: icon rail on the left, one centred column of content, footer */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh">
      <Sidebar onSearch={() => setSearchOpen(true)} onAssistant={() => setAssistantOpen(true)} />
      <div className="pb-20 md:pb-0 md:pl-[72px] xl:pl-60">
        <main className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 md:pt-6">
          {children}
          <Footer />
        </main>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      {assistantOpen && (
        <Suspense>
          <AssistantDialog open={assistantOpen} onOpenChange={setAssistantOpen} />
        </Suspense>
      )}
    </div>
  );
}
