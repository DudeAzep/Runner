import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const COLUMNS = [
  {
    title: "Platform",
    links: [
      { href: "/explore", label: "Explore campaigns" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/dashboard", label: "Holder dashboard" },
    ],
  },
  {
    title: "Projects",
    links: [
      { href: "/submit", label: "Submit a project" },
      { href: "/status", label: "Application status" },
      { href: "/how-it-works#screening", label: "Screening criteria" },
    ],
  },
  {
    title: "Transparency",
    links: [
      { href: "/how-it-works#allocation", label: "Revenue allocation" },
      { href: "/how-it-works#rewards", label: "Reward formula" },
      { href: "#risk", label: "Risk disclosure" },
    ],
  },
];

export function RiskDisclosure({ id }: { id?: string }) {
  return (
    <div id={id} className="scroll-mt-24 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-5">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
        <div className="space-y-2 text-xs leading-relaxed text-fg-muted">
          <p className="font-medium text-fg">Risk disclosure</p>
          <p>
            Memecoins are highly speculative and volatile. Campaign participation does not guarantee token appreciation, liquidity,
            profits, or successful project outcomes. Reward tokens may lose some or all of their value. RUNNER screening is an
            independent risk review, not an endorsement, audit, or investment recommendation.
          </p>
          <p>
            Nothing on this site is financial, investment, legal, or tax advice. Reward eligibility, distribution amounts, and timing
            are not guaranteed and may vary by jurisdiction. Do your own research and only participate with funds you can afford to lose.
          </p>
          <p className="text-fg-subtle">
            This MVP displays clearly labeled <span className="text-amber-400">DEMO DATA</span>. Payments are simulated (TEST MODE), and no
            on-chain purchases or distributions are executed.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-700 bg-ink-950">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-fg-muted">
              Discover the Next Runner. A curated Solana memecoin rewards ecosystem.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="label">{col.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-sm text-fg-muted transition hover:text-fg">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12">
          <RiskDisclosure id="risk" />
        </div>
        <div className="mt-8 flex flex-col justify-between gap-3 text-xs text-fg-subtle sm:flex-row">
          <span>© {new Date().getUTCFullYear()} RUNNER. Built on Solana.</span>
          <span>Campaign fees do not purchase approval or endorsement.</span>
        </div>
      </div>
    </footer>
  );
}
