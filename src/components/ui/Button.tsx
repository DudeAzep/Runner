import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "volt" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 rounded-md";

const variants: Record<Variant, string> = {
  primary:
    "bg-violet-500 text-white shadow-[0_0_0_1px_rgb(139_92_246/0.5),0_8px_24px_-8px_rgb(139_92_246/0.6)] hover:bg-violet-400",
  volt: "bg-volt-400 text-ink-950 shadow-[0_8px_24px_-10px_rgb(76_247_166/0.7)] hover:bg-volt-300",
  secondary: "bg-ink-800 text-fg border border-ink-600 hover:border-ink-500 hover:bg-ink-750",
  ghost: "text-fg-muted hover:text-fg hover:bg-ink-800",
  danger: "bg-rose-400/10 text-rose-400 border border-rose-400/30 hover:bg-rose-400/20",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  external,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  external?: boolean;
}) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClasses(variant, size, className)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}
