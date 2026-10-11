import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

interface SectionProps {
  title: string;
  icon?: LucideIcon;
  count?: number | string | null;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Titled block used across pages: heading, optional count in mono and a right-side action */
export function Section({ title, icon: Icon, count, action, className, children }: SectionProps) {
  return (
    <section className={cn("mt-14", className)}>
      <header className="mb-4 flex items-baseline justify-between gap-3 border-b border-border pb-3">
        <h2 className="flex items-baseline gap-2.5 text-xl">
          {Icon && <Icon className="size-4 self-center text-dimmed" />}
          {title}
          {count !== undefined && count !== null && <span className="eyebrow">{count}</span>}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
