import { FlaskConical, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { DataSource } from "@/lib/types";

export type Tone = "neutral" | "violet" | "volt" | "amber" | "rose" | "sky";

const tones: Record<Tone, string> = {
  neutral: "bg-ink-700/60 text-fg-muted border-ink-600",
  violet: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  volt: "bg-volt-400/10 text-volt-400 border-volt-400/30",
  amber: "bg-amber-400/10 text-amber-400 border-amber-400/30",
  rose: "bg-rose-400/10 text-rose-400 border-rose-400/30",
  sky: "bg-sky-400/10 text-sky-400 border-sky-400/30",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-[11px] font-medium tracking-wide whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/** Explicit provenance marker. Every demo record is labeled. */
export function SourceBadge({ source, className }: { source: DataSource; className?: string }) {
  if (source === "verified") {
    return (
      <Badge tone="volt" className={className} title="Verified against on-chain data">
        <ShieldCheck className="size-3" aria-hidden /> VERIFIED ON-CHAIN
      </Badge>
    );
  }
  return (
    <Badge tone="amber" className={className} title="Fictional sample data for demonstration. Not real market or blockchain data.">
      <FlaskConical className="size-3" aria-hidden /> DEMO DATA
    </Badge>
  );
}
