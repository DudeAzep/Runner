import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function StatisticsCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "violet",
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: ReactNode;
  accent?: "violet" | "volt" | "neutral";
  className?: string;
}) {
  return (
    <div className={cn("surface relative overflow-hidden p-5", className)}>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px",
          accent === "violet" && "bg-gradient-to-r from-transparent via-violet-500/60 to-transparent",
          accent === "volt" && "bg-gradient-to-r from-transparent via-volt-400/60 to-transparent",
        )}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="label">{label}</span>
        {Icon && <Icon className={cn("size-4", accent === "volt" ? "text-volt-400" : "text-violet-400")} aria-hidden />}
      </div>
      <div className="tabular mt-3 text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-fg-subtle">{hint}</div>}
    </div>
  );
}
