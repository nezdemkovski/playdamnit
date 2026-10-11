import type { UserGameWithUserData } from "@playdamnit/api-client";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { GameCover } from "@/components/game/game-cover";
import { Button } from "@/components/ui/button";
import { idleDays, summarize, verdictLine } from "@/lib/voice";

/** Count up from zero once, unless the viewer prefers reduced motion */
const useCountUp = (target: number) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 700 + target * 6;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
};

/** The signed-in home: the verdict headline and the longest-ignored game */
export function Verdict({
  username,
  entries,
}: {
  username: string;
  entries: UserGameWithUserData[];
}) {
  const s = useMemo(() => summarize(entries), [entries]);
  const added = useCountUp(s.total);
  const finished = useCountUp(s.finished);
  const exhibit = s.longestIdle ?? s.stalePlaying;

  return (
    <section className="grid border-b border-border md:grid-cols-[1.3fr_1fr]">
      <div className="py-10 md:py-12">
        <div className="eyebrow">Status report · @{username}</div>
        <h1 className="mt-4 text-4xl leading-[.95] sm:text-5xl lg:text-6xl">
          You've added <span className="num font-extrabold">{added}</span> games.
          <br />
          You've finished <span className="num font-extrabold text-signal">{finished}</span>.
        </h1>
        <p className="mt-5 max-w-[44ch] text-lg text-dimmed">{verdictLine(s)}</p>
        <div className="mt-7 flex flex-wrap gap-2">
          {exhibit ? (
            <Button asChild variant="destructive">
              <Link to="/games/$id" params={{ id: String(exhibit.id) }}>
                Pick one and play it
              </Link>
            </Button>
          ) : (
            <Button asChild variant="destructive">
              <Link to="/search" search={{ q: "", page: 1, editions: false }}>
                Add your first game
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/$username" params={{ username }}>
              Show the damage
            </Link>
          </Button>
        </div>
      </div>
      {exhibit && (
        <div className="relative border-t border-border py-8 md:border-t-0 md:border-l md:py-12 md:pl-10">
          <div className="eyebrow">
            {s.longestIdle ? "Exhibit A · longest ignored" : 'Exhibit A · stalest "playing"'}
          </div>
          <div className="num absolute top-8 right-0 bg-signal px-2 py-1 text-[11px] font-extrabold text-black md:top-12">
            {idleDays(exhibit)}D
          </div>
          <h2 className="mt-3 pr-20 text-2xl">{exhibit.name}</h2>
          <div className="mt-4 flex gap-4">
            <Link to="/games/$id" params={{ id: String(exhibit.id) }} className="w-20 shrink-0">
              <GameCover url={exhibit.cover?.url} name={exhibit.name} />
            </Link>
            <div className="text-sm text-dimmed">
              <p>
                Added{" "}
                <b className="text-foreground">
                  {new Date(exhibit.userGameData.addedAt ?? Date.now()).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                  })}
                </b>
                . Opened{" "}
                <b className="text-foreground">{s.longestIdle ? "never" : "a while ago"}</b>. It's
                not going to play itself.
              </p>
              <div className="mt-3 h-1.5 bg-card">
                <i
                  className="block h-full bg-signal"
                  style={{ width: `${Math.min(100, (idleDays(exhibit) / 180) * 100)}%` }}
                />
              </div>
              <div className="num mt-1.5 text-[11px] text-dimmed">
                {idleDays(exhibit)} days of its life in your backlog
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
