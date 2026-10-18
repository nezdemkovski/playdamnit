import { useEffect, useState } from "react";

import { Footer } from "./footer";
import { SearchDialog } from "./search-dialog";
import { Sidebar } from "./sidebar";
import { Hotkey } from "@/lib/enums";
import { useSession } from "@/hooks/auth";
import { useSteamReturn } from "@/components/steam/use-steam-return";

/** Page frame: icon rail on the left, one centred column of content, footer */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { user } = useSession();
  useSteamReturn(user?.username ?? undefined);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === Hotkey.Search) {
        event.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh">
      <Sidebar onSearch={() => setSearchOpen(true)} />
      <div className="pb-20 md:pb-0 md:pl-[72px] xl:pl-60">
        <main className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 md:pt-6">
          {children}
          <Footer />
        </main>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
