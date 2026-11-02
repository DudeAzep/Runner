import { cn } from "@/lib/cn";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Deterministic monogram logo. No third-party images are loaded for demo
 * projects; a real logo URL can be passed once projects upload one.
 */
export function ProjectLogo({
  ticker,
  name,
  size = 44,
  src,
  className,
}: {
  ticker: string;
  name: string;
  size?: number;
  src?: string | null;
  className?: string;
}) {
  const h = hash(ticker);
  const hueA = 250 + (h % 70); // violet → blue range
  const hueB = 140 + ((h >> 8) % 40); // green range
  const angle = (h >> 16) % 360;
  const letters = ticker.slice(0, 2);

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`${name} logo`} width={size} height={size} className={cn("rounded-md object-cover", className)} />;
  }

  return (
    <span
      role="img"
      aria-label={`${name} logo`}
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10", className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(${angle}deg, oklch(0.42 0.16 ${hueA}) 0%, oklch(0.24 0.05 ${hueA}) 55%, oklch(0.5 0.15 ${hueB}) 140%)`,
      }}
    >
      <span className="font-mono font-semibold tracking-tight text-white/95" style={{ fontSize: size * 0.34 }}>
        {letters}
      </span>
    </span>
  );
}
