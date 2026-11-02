import { cn } from "@/lib/cn";

/**
 * RUNNER mark: speed lines converging into a forward chevron —
 * movement, discovery, and forward momentum.
 */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient id="runner-mark-g" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#4CF7A6" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="#121218" stroke="#2A2A36" />
      <path d="M14.5 8.5 22 16l-7.5 7.5" stroke="url(#runner-mark-g)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 16h11" stroke="url(#runner-mark-g)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M8 11.25h3.5M8 20.75h3.5" stroke="#8B5CF6" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="text-[15px] font-semibold tracking-[0.22em] text-fg">
          RUNNER
        </span>
      )}
    </span>
  );
}
