import { useGetApiGames, type Game } from "@playdamnit/api-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarIcon, FlameIcon, Gamepad2Icon, LibraryIcon } from "lucide-react";

import { GameCard, GameRail } from "@/components/game/game-card";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/auth";
import { useMyLibrary } from "@/hooks/library";

export const Route = createFileRoute("/")({
  component: Home,
});

const RAIL = 20;

function Home() {
  const { user } = useSession();
  const { byGameId, entries } = useMyLibrary();
  const popular = useGetApiGames({ sort: "popular", limit: RAIL });
  const recent = useGetApiGames({ sort: "recent", limit: RAIL });

  const playing = entries.filter((e) => e.userGameData.status === "playing").slice(0, RAIL);
  const latest = entries.slice(0, RAIL);

  return (
    <>
      <section className="panel relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-status-finished/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-status-playing/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <img src="/logo.svg" alt="" className="h-20 w-auto shrink-0 rounded-xl sm:h-28" />
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              {user ? `Welcome back, ${user.username ?? user.name}` : "Play, damn it."}
            </h1>
            <p className="mt-2 max-w-xl text-dimmed">
              Track every game you play, rate it, write a few words and keep the backlog honest. The
              whole IGDB catalog, no account needed to browse.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {user ? (
                <Button asChild size="lg">
                  <Link to="/$username" params={{ username: user.username ?? "" }}>
                    <LibraryIcon /> My list
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link to="/auth">Create your list</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg">
                <Link to="/search" search={{ q: "", page: 1, editions: false }}>
                  <Gamepad2Icon /> Browse games
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {playing.length > 0 && (
        <Section title="Now playing" icon={Gamepad2Icon} count={playing.length}>
          <GameRail>
            {playing.map((g) => (
              <GameCard key={g.id} game={g} rating={g.userGameData.rating} />
            ))}
          </GameRail>
        </Section>
      )}

      <Section title="Trending" icon={FlameIcon}>
        <Rail games={popular.data?.results} byGameId={byGameId} />
      </Section>

      <Section title="New releases" icon={CalendarIcon}>
        <Rail games={recent.data?.results} byGameId={byGameId} />
      </Section>

      {latest.length > 0 && (
        <Section title="Recently added to your list" icon={LibraryIcon}>
          <GameRail>
            {latest.map((g) => (
              <GameCard key={g.id} game={g} rating={g.userGameData.rating} />
            ))}
          </GameRail>
        </Section>
      )}
    </>
  );
}

function Rail({
  games,
  byGameId,
}: {
  games: Game[] | undefined;
  byGameId: ReturnType<typeof useMyLibrary>["byGameId"];
}) {
  if (!games) {
    return (
      <GameRail>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="cover" />
        ))}
      </GameRail>
    );
  }
  if (games.length === 0)
    return <p className="text-sm text-dimmed">The catalog is still filling up.</p>;
  return (
    <GameRail>
      {games.map((g) => (
        <GameCard key={g.id} game={g} rating={byGameId.get(g.id)?.userGameData.rating} />
      ))}
    </GameRail>
  );
}
