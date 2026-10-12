import { createFileRoute } from "@tanstack/react-router";
import { cn } from "cn";
import { useTranslation } from "react-i18next";

import { CHANGELOG } from "@/changelog";
import { Namespace } from "@/i18n";
import { format } from "@/i18n/date";
import { ChangeKind, DateFormat } from "@/lib/enums";

export const Route = createFileRoute("/changelog")({
  component: Changelog,
});

// New is the news; changes and fixes stay quiet
const KIND_CLASS: Record<ChangeKind, string> = {
  [ChangeKind.New]: "border-signal/60 text-signal",
  [ChangeKind.Changed]: "border-border text-foreground/80",
  [ChangeKind.Fixed]: "border-border text-dimmed",
};

function Changelog() {
  const { t } = useTranslation(Namespace.Changelog);
  return (
    <>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <div className="mt-6 max-w-3xl">
        {CHANGELOG.map((release) => (
          <section
            key={release.version}
            id={release.version}
            className="border-t border-border py-6 first:border-t-0 first:pt-0"
          >
            <h2 className="num flex items-baseline gap-3 text-lg">
              {release.version}
              <span className="eyebrow">
                {format(new Date(`${release.date}T12:00:00`), DateFormat.MonthDayYearShort)}
              </span>
            </h2>
            <ul className="mt-4 space-y-4">
              {release.changes.map((change) => (
                <li key={change.title} className="grid grid-cols-[5.5rem_1fr] items-baseline gap-3">
                  <span
                    className={cn(
                      "eyebrow justify-self-start border px-1.5 py-1",
                      KIND_CLASS[change.kind],
                    )}
                  >
                    {t(`kinds.${change.kind}`)}
                  </span>
                  <div>
                    <div className="font-semibold">{change.title}</div>
                    {change.details && (
                      <ul className="mt-1 space-y-0.5 text-sm text-dimmed">
                        {change.details.map((detail) => (
                          <li key={detail}>{detail}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
