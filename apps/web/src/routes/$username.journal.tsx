import {
  JournalItemKind,
  useGetApiUserByUsernameJournal,
  type JournalItem,
} from "@playdamnit/api-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { parse } from "date-fns";
import { RepeatIcon, TrophyIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { GameCover } from "@/components/game/game-cover";
import { GradeBadge, StatusPill } from "@/components/game/rating";
import { PrivateNotice } from "@/components/profile/private-notice";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileContext } from "@/hooks/profile";
import { format } from "@/i18n/date";
import { AllOption, DateFormat, IgdbSize } from "@/lib/enums";

export const Route = createFileRoute("/$username/journal")({
  validateSearch: (raw: Record<string, unknown>) => ({
    year: typeof raw.year === "number" ? raw.year : undefined,
  }),
  component: ProfileJournal,
});

/** Playthroughs and finished entries by month, like Backloggd's journal */
function ProfileJournal() {
  const { t } = useTranslation();
  const { username } = useProfileContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const journal = useGetApiUserByUsernameJournal(username, { year: search.year });

  const { months, years } = useMemo(() => {
    const items = journal.data?.results ?? [];
    const groups = new Map<string, JournalItem[]>();
    const yearSet = new Set<number>();
    for (const item of items) {
      const key = item.date.slice(0, 7);
      groups.set(key, [...(groups.get(key) ?? []), item]);
      yearSet.add(Number(item.date.slice(0, 4)));
    }
    return { months: [...groups.entries()], years: [...yearSet].sort((a, b) => b - a) };
  }, [journal.data]);

  if (journal.data?.private) return <PrivateNotice />;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-dimmed">{t("profile.journal.intro")}</p>
        <Select
          value={search.year !== undefined ? String(search.year) : AllOption.All}
          onValueChange={(v) =>
            navigate({ search: { year: v === AllOption.All ? undefined : Number(v) } })
          }
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AllOption.All}>{t("profile.journal.allYears")}</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {journal.isPending && <Skeleton className="mt-4 h-40 rounded-card" />}
      {journal.data && months.length === 0 && (
        <div className="panel mt-4 p-12 text-center text-dimmed">{t("profile.journal.empty")}</div>
      )}

      {months.map(([month, items]) => (
        <section key={month} className="mt-6">
          <h2 className="mb-2 text-lg font-bold">
            {format(parse(month, DateFormat.IsoMonth, new Date()), DateFormat.MonthYear)}
          </h2>
          <ol className="space-y-1">
            {items.map((item) => (
              <li key={item.id} className="panel flex items-center gap-3 p-2 pr-4">
                <span className="w-8 text-center text-lg font-bold tabular-nums">
                  {item.date.slice(8, 10)}
                </span>
                <Link
                  to="/games/$id"
                  params={{ id: String(item.game.id) }}
                  className="w-10 shrink-0"
                >
                  <GameCover
                    url={item.game.cover?.url}
                    name={item.game.name}
                    size={IgdbSize.CoverSmall}
                    className="rounded-md"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/games/$id"
                    params={{ id: String(item.game.id) }}
                    className="line-clamp-1 font-semibold hover:underline"
                  >
                    {item.game.name}
                  </Link>
                  <div className="truncate text-xs text-dimmed">
                    {item.kind === JournalItemKind.Playthrough ? (
                      <>
                        <RepeatIcon className="mr-1 inline size-3" />
                        {[
                          item.startedAt && t("profile.journal.from", { date: item.startedAt }),
                          item.hours && `${item.hours}h`,
                          item.platform?.name,
                          item.note,
                        ]
                          .filter(Boolean)
                          .join(" · ") || t("profile.journal.playthrough")}
                      </>
                    ) : (
                      (item.platform?.name ?? "")
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {item.mastered && <TrophyIcon className="size-4 text-warning" />}
                  <GradeBadge grade={item.grade} />
                  {item.status && <StatusPill status={item.status} />}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}
