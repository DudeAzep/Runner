import { Globe, MessageCircle, Send } from "lucide-react";
import type { ProjectLinks } from "@/lib/types";
import { cn } from "@/lib/cn";

function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z" />
    </svg>
  );
}

export function SocialLinks({ links, className, size = "md" }: { links: ProjectLinks; className?: string; size?: "sm" | "md" }) {
  const items = [
    { href: links.website, label: "Website", Icon: Globe },
    { href: links.twitter, label: "X / Twitter", Icon: XGlyph },
    { href: links.telegram, label: "Telegram", Icon: Send },
    { href: links.discord, label: "Discord", Icon: MessageCircle },
  ].filter((i) => i.href);
  const box = size === "sm" ? "size-7" : "size-8";
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {items.map(({ href, label, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          aria-label={label}
          title={label}
          className={cn(
            box,
            "inline-flex items-center justify-center rounded-md border border-ink-600 bg-ink-850 text-fg-muted transition hover:border-ink-500 hover:text-fg",
          )}
        >
          <Icon className="size-3.5" />
        </a>
      ))}
    </div>
  );
}
