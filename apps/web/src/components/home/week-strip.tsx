import type { HomeWeekDay } from "@playdamnit/api-client";
import { cn } from "cn";
import { parseISO } from "date-fns";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { GameCard, GameRail } from "@/components/game/game-card";
import type { useMyLibrary } from "@/hooks/library";
import { format } from "@/i18n/date";
import { DateFormat } from "@/lib/enums";

/**
 * The week's releases as the API sends them: seven UTC days with how many games come out on
 * each; the day picked shows its most popular games. The first day with releases starts picked.
 */
export function WeekStrip({
  days,
  byGameId,
}: {
  days: HomeWeekDay[];
  byGameId: ReturnType<typeof useMyLibrary>["byGameId"];
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? days.find((d) => d.count > 0)?.date ?? days[0]?.date;
  const shown = days.find((d) => d.date === selected)?.games ?? [];

  return (
    <>
      <div className="grid grid-cols-7 gap-px border border-border bg-border">
        {days.map((day) => {
          const date = parseISO(day.date);
          const active = day.date === selected;
          return (
            <button
              key={day.date}
              type="button"
              disabled={day.count === 0}
              aria-pressed={active}
              aria-label={`${format(date, DateFormat.WeekdayMonthDay)}: ${t("home.week.releases", { count: day.count })}`}
              onClick={() => setPicked(day.date)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2.5 transition-colors disabled:cursor-default",
                active ? "bg-foreground text-background" : "bg-background hover:bg-card",
              )}
            >
              <span className={cn("eyebrow", active && "text-background")}>
                {format(date, DateFormat.WeekdayShort)}
              </span>
              <span
                className={cn(
                  "num text-2xl font-extrabold",
                  !active && day.count === 0 && "text-dimmed",
                )}
              >
                {format(date, DateFormat.DayOfMonth)}
              </span>
              <span
                className={cn(
                  "num text-xs",
                  active ? "text-background" : day.count > 0 ? "text-signal" : "text-dimmed",
                )}
              >
                {day.count > 0 ? day.count : "·"}
              </span>
            </button>
          );
        })}
      </div>
      {shown.length > 0 && (
        <GameRail key={selected} className="mt-4">
          {shown.map((g) => (
            <GameCard key={g.id} game={g} grade={byGameId.get(g.id)?.userGameData.grade} />
          ))}
        </GameRail>
      )}
    </>
  );
}
