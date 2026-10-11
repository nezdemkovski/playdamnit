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

/** Titled block used across pages: icon, heading, optional count and a right-side action */
export function Section({ title, icon: Icon, count, action, className, children }: SectionProps) {
  return (
    <section className={cn("mt-10", className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          {Icon && <Icon className="size-5 text-dimmed" />}
          {title}
          {count !== undefined && count !== null && (
            <span className="text-sm font-semibold text-dimmed">{count}</span>
          )}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
