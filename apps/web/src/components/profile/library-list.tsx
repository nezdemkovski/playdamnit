import type { UserGameWithUserData } from "@playdamnit/api-client";
import { ArrowDownUpIcon, LayoutGridIcon, ListIcon, SearchIcon } from "lucide-react";
import { cn } from "cn";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GameCard } from "@/components/game/game-card";
import { STATUSES, type LibraryStatus } from "@/lib/statuses";
import { idleDays } from "@/lib/voice";
import { LibraryRow } from "./library-row";

const ALL_YEARS = "all";

type Sort = "shame" | "added" | "rating" | "name" | "release";
const SORTS: Sort[] = ["shame", "added", "rating", "name", "release"];

// Untouched backlog first, then stale "playing", finished games last
const SHAME_RANK: Record<string, number> = {
  backlog: 0,
  want_to_play: 0,
  on_hold: 1,
  playing: 2,
  online: 3,
  dropped: 4,
  finished: 5,
};

const compare: Record<Sort, (a: UserGameWithUserData, b: UserGameWithUserData) => number> = {
  shame: (a, b) =>
    SHAME_RANK[a.userGameData.status] - SHAME_RANK[b.userGameData.status] ||
    idleDays(b) - idleDays(a),
  added: (a, b) => (b.userGameData.addedAt ?? "").localeCompare(a.userGameData.addedAt ?? ""),
  rating: (a, b) => (b.userGameData.rating ?? -1) - (a.userGameData.rating ?? -1),
  name: (a, b) => a.name.localeCompare(b.name),
  release: (a, b) => (b.firstReleaseDate ?? 0) - (a.firstReleaseDate ?? 0),
};

interface LibraryListProps {
  entries: UserGameWithUserData[];
  editable: boolean;
}

/** Status tabs with counts, search-in-list, sort and the ranked rows */
export function LibraryList({ entries, editable }: LibraryListProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<LibraryStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("shame");
  const [view, setView] = useState<"list" | "grid">(() => {
    try {
      return localStorage.getItem("library-view") === "grid" ? "grid" : "list";
    } catch {
      return "list";
    }
  });
  const [year, setYear] = useState<string>(ALL_YEARS);
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const e of entries) {
      const d = e.userGameData.endedAt ?? e.userGameData.addedAt;
      if (d) set.add(new Date(d).getFullYear());
    }
    return [...set].sort((a, b) => b - a);
  }, [entries]);
  const switchView = (v: "list" | "grid") => {
    setView(v);
    try {
      localStorage.setItem("library-view", v);
    } catch {
      // storage may be unavailable
    }
  };

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries)
      map.set(entry.userGameData.status, (map.get(entry.userGameData.status) ?? 0) + 1);
    return map;
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => status === "all" || e.userGameData.status === status)
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          e.alternativeNames.some((n) => n.toLowerCase().includes(q)),
      )
      .sort(compare[sort]);
  }, [entries, status, query, sort]);

  return (
    <div className="mt-4 space-y-3">
      <div className="no-scrollbar flex gap-1 overflow-x-auto px-1">
        <StatusTab
          label={t("profile.library.all")}
          count={entries.length}
          active={status === "all"}
          onClick={() => setStatus("all")}
        />
        {STATUSES.map((s) => (
          <StatusTab
            key={s.value}
            label={s.label}
            icon={<s.icon className="size-3" />}
            count={counts.get(s.value) ?? 0}
            active={status === s.value}
            onClick={() => setStatus(s.value)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 basis-full sm:basis-auto">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dimmed" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("profile.library.search")}
            className="rounded-full pl-9"
          />
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger size="sm" className="w-24 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_YEARS}>{t("profile.library.allYears")}</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex rounded-full bg-white/5 p-0.5">
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={t("profile.library.listView")}
            aria-pressed={view === "list"}
            onClick={() => switchView("list")}
          >
            <ListIcon />
          </Button>
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={t("profile.library.gridView")}
            aria-pressed={view === "grid"}
            onClick={() => switchView("grid")}
          >
            <LayoutGridIcon />
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              {t(`profile.library.sort.${sort}`)} <ArrowDownUpIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as Sort)}>
              {SORTS.map((value) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {t(`profile.library.sort.${value}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {visible.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-dimmed">
          {entries.length === 0 ? t("profile.library.emptyList") : t("profile.library.noMatch")}
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {visible.map((entry) => (
            <GameCard key={entry.id} game={entry} rating={entry.userGameData.rating} />
          ))}
        </div>
      ) : (
        <div className="border-t border-border">
          {visible.map((entry, i) => (
            <LibraryRow key={entry.id} rank={i + 1} entry={entry} editable={editable} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusTab({
  label,
  icon,
  count,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 flex-col items-center rounded-lg px-3 py-1.5 text-xs transition-colors",
        active ? "bg-white/10 text-white" : "text-dimmed hover:text-white",
      )}
    >
      <span className="flex items-center gap-1">
        {label}
        {icon}
      </span>
      <span className="text-base font-bold tabular-nums text-white">{count}</span>
    </button>
  );
}
