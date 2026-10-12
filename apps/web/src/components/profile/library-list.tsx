import {
  getApiUserByUsernameGames,
  getGetApiUserByUsernameGamesQueryKey,
  LibrarySortEnum,
  type LibraryIndexItem,
} from "@playdamnit/api-client";
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
import { Skeleton } from "@/components/ui/skeleton";
import { GameCard } from "@/components/game/game-card";
import { LoadMore } from "@/components/load-more";
import { useDebounced } from "@/hooks/debounced";
import { usePaged } from "@/hooks/paged";
import { STATUSES, type LibraryStatus } from "@/lib/statuses";
import { LibraryRow } from "./library-row";
import { AllOption, LibraryView, StorageKey } from "@/lib/enums";
import { gradeOf } from "@/lib/grade";

const SORTS = Object.values(LibrarySortEnum);
const PAGE = 50;

interface LibraryListProps {
  username: string;
  /** The whole library, light: the tab counts and the filter options come from it */
  entries: LibraryIndexItem[];
  editable: boolean;
}

/** Status tabs with counts, search-in-list, sort and the ranked rows, a page at a time */
export function LibraryList({ username, entries, editable }: LibraryListProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<LibraryStatus | AllOption>(AllOption.All);
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 250);
  const [sort, setSort] = useState(LibrarySortEnum.Shame);
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
  // The server filters and sorts; the rows are full cards (genres, type, review)
  const params = { status: status === AllOption.All ? undefined : status, q: q || undefined, sort };
  const list = usePaged({
    queryKey: getGetApiUserByUsernameGamesQueryKey(username, params),
    fetchPage: (offset, limit, signal) =>
      getApiUserByUsernameGames(username, { ...params, limit, offset }, undefined, signal),
    pageSize: PAGE,
    keepPrevious: true,
  });
  const switchView = (v: LibraryView) => {
    setView(v);
    try {
      localStorage.setItem(StorageKey.LibraryView, v);
    } catch {
      // storage may be unavailable
    }
  };

  // Hours only sort anything once Steam has filled them in
  const sorts = useMemo(
    () =>
      entries.some((e) => e.userGameData.steamMinutes)
        ? SORTS
        : SORTS.filter((s) => s !== LibrarySortEnum.Hours),
    [entries],
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries)
      map.set(entry.userGameData.status, (map.get(entry.userGameData.status) ?? 0) + 1);
    return map;
  }, [entries]);

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
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(v) => setSort(v as LibrarySortEnum)}
            >
              {sorts.map((value) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {t(`profile.library.sort.${value}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {list.isPending ? (
        <Skeleton className="h-64 rounded-card" />
      ) : list.items.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-dimmed">
          {entries.length === 0 ? t("profile.library.emptyList") : t("profile.library.noMatch")}
        </div>
      ) : view === LibraryView.Grid ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {list.items.map((entry) => (
            <GameCard key={entry.id} game={entry} grade={gradeOf(entry.userGameData.rating)} />
          ))}
        </div>
      ) : (
        <div className="border-t border-border">
          {list.items.map((entry, i) => (
            <LibraryRow key={entry.id} rank={i + 1} entry={entry} editable={editable} />
          ))}
        </div>
      )}
      <LoadMore {...list} />
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
