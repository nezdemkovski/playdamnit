import { type UserGameWithUserData, StatusEnum } from "@playdamnit/api-client";
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
import { AllOption, LibrarySort, LibraryView, StorageKey } from "@/lib/enums";

const SORTS = Object.values(LibrarySort);

// Untouched backlog first, then stale "playing", finished games last
const SHAME_RANK: Record<StatusEnum, number> = {
  [StatusEnum.Backlog]: 0,
  [StatusEnum.WantToPlay]: 0,
  [StatusEnum.OnHold]: 1,
  [StatusEnum.Playing]: 2,
  [StatusEnum.Online]: 3,
  [StatusEnum.Dropped]: 4,
  [StatusEnum.Finished]: 5,
};

const compare: Record<LibrarySort, (a: UserGameWithUserData, b: UserGameWithUserData) => number> = {
  [LibrarySort.Shame]: (a, b) =>
    SHAME_RANK[a.userGameData.status] - SHAME_RANK[b.userGameData.status] ||
    idleDays(b) - idleDays(a),
  [LibrarySort.Added]: (a, b) =>
    (b.userGameData.addedAt ?? "").localeCompare(a.userGameData.addedAt ?? ""),
  [LibrarySort.Rating]: (a, b) => (b.userGameData.rating ?? -1) - (a.userGameData.rating ?? -1),
  [LibrarySort.Name]: (a, b) => a.name.localeCompare(b.name),
  [LibrarySort.Release]: (a, b) => (b.firstReleaseDate ?? 0) - (a.firstReleaseDate ?? 0),
};

interface LibraryListProps {
  entries: UserGameWithUserData[];
  editable: boolean;
}

/** Status tabs with counts, search-in-list, sort and the ranked rows */
export function LibraryList({ entries, editable }: LibraryListProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<LibraryStatus | AllOption>(AllOption.All);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(LibrarySort.Shame);
  const [view, setView] = useState<LibraryView>(() => {
    try {
      return localStorage.getItem(StorageKey.LibraryView) === LibraryView.Grid
        ? LibraryView.Grid
        : LibraryView.List;
    } catch {
      return LibraryView.List;
    }
  });
  const [year, setYear] = useState<string>(AllOption.All);
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const e of entries) {
      const d = e.userGameData.endedAt ?? e.userGameData.addedAt;
      if (d) set.add(new Date(d).getFullYear());
    }
    return [...set].sort((a, b) => b - a);
  }, [entries]);
  const switchView = (v: LibraryView) => {
    setView(v);
    try {
      localStorage.setItem(StorageKey.LibraryView, v);
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
      .filter((e) => status === AllOption.All || e.userGameData.status === status)
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
          active={status === AllOption.All}
          onClick={() => setStatus(AllOption.All)}
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
            <SelectItem value={AllOption.All}>{t("profile.library.allYears")}</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex rounded-full bg-white/5 p-0.5">
          <Button
            variant={view === LibraryView.List ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={t("profile.library.listView")}
            aria-pressed={view === LibraryView.List}
            onClick={() => switchView(LibraryView.List)}
          >
            <ListIcon />
          </Button>
          <Button
            variant={view === LibraryView.Grid ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={t("profile.library.gridView")}
            aria-pressed={view === LibraryView.Grid}
            onClick={() => switchView(LibraryView.Grid)}
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
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as LibrarySort)}>
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
      ) : view === LibraryView.Grid ? (
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
