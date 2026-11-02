import { FlaskConical, Inbox, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CampaignCard } from "@/components/campaign/CampaignCard";
import { Container, PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { getRepositoryForRequest } from "@/lib/data";
import { cn } from "@/lib/cn";
import type { CampaignFilter, CampaignSort } from "@/lib/types";

export const metadata: Metadata = { title: "Explore Campaigns" };

const FILTERS: { id: CampaignFilter; label: string }[] = [
  { id: "all", label: "All campaigns" },
  { id: "approved", label: "Approved" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
];

const SORTS: { id: CampaignSort; label: string }[] = [
  { id: "recent", label: "Recently approved" },
  { id: "market_cap", label: "Market capitalization" },
  { id: "allocation", label: "Campaign allocation" },
];

function pick<T extends string>(value: string | string[] | undefined, allowed: readonly T[], fallback: T): T {
  const v = Array.isArray(value) ? value[0] : value;
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filter = pick(sp.filter, FILTERS.map((f) => f.id), "all");
  const sort = pick(sp.sort, SORTS.map((s) => s.id), "recent");
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.slice(0, 64) ?? "";

  const repo = await getRepositoryForRequest();
  const [campaigns, all] = await Promise.all([repo.listCampaigns({ filter, sort, search: q }), repo.listCampaigns()]);
  const counts: Record<CampaignFilter, number> = {
    all: all.length,
    approved: all.filter((c) => c.status === "active").length,
    upcoming: all.filter((c) => c.status === "upcoming").length,
    completed: all.filter((c) => c.status === "completed").length,
  };

  const href = (next: Partial<{ filter: string; sort: string; q: string }>) => {
    const p = new URLSearchParams();
    const f = next.filter ?? filter;
    const s = next.sort ?? sort;
    const query = next.q ?? q;
    if (f !== "all") p.set("filter", f);
    if (s !== "recent") p.set("sort", s);
    if (query) p.set("q", query);
    const str = p.toString();
    return str ? `/explore?${str}` : "/explore";
  };

  return (
    <Container>
      <PageHeader
        eyebrow="Campaign marketplace"
        title="Explore campaigns"
        description="Every campaign below passed RUNNER's independent screening. Figures are captured at screening time and do not reflect current market conditions."
      />

      <div className="flex items-start gap-3 rounded-md border border-amber-400/25 bg-amber-400/[0.05] px-4 py-3 text-sm text-fg-muted">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
        <p>
          Records marked <span className="font-medium text-amber-400">DEMO DATA</span> are fictional sample projects. Only records marked{" "}
          <span className="font-medium text-volt-400">VERIFIED ON-CHAIN</span> reflect live Solana data.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter campaigns" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex w-max gap-1 rounded-md border border-ink-700 bg-ink-850 p-1">
            {FILTERS.map((f) => (
              <li key={f.id}>
                <Link
                  href={href({ filter: f.id })}
                  aria-current={filter === f.id ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-[5px] px-3 py-1.5 text-sm transition",
                    filter === f.id ? "bg-ink-700 text-fg" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {f.label}
                  <span className="tabular text-xs text-fg-subtle">{counts[f.id]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <form action="/explore" className="relative" role="search">
            {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
            {sort !== "recent" && <input type="hidden" name="sort" value={sort} />}
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search name, ticker, or address"
              aria-label="Search campaigns"
              className="field h-10 pl-9 sm:w-64"
            />
          </form>
          <div className="flex min-w-0 items-center gap-2">
            <span className="label shrink-0">Sort</span>
            <div className="flex min-w-0 gap-1 overflow-x-auto rounded-md border border-ink-700 bg-ink-850 p-1">
              {SORTS.map((s) => (
                <Link
                  key={s.id}
                  href={href({ sort: s.id })}
                  aria-current={sort === s.id ? "true" : undefined}
                  className={cn(
                    "whitespace-nowrap rounded-[5px] px-2.5 py-1.5 text-xs transition",
                    sort === s.id ? "bg-ink-700 text-fg" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {campaigns.length > 0 ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      ) : (
        <div className="surface mt-8 flex flex-col items-center px-6 py-16 text-center">
          <Inbox className="size-8 text-fg-subtle" aria-hidden />
          <h2 className="mt-4 text-base font-semibold">No campaigns match</h2>
          <p className="mt-2 max-w-sm text-sm text-fg-muted">Try a different filter or search term.</p>
          <ButtonLink href="/explore" variant="secondary" className="mt-6">
            Reset filters
          </ButtonLink>
        </div>
      )}
    </Container>
  );
}
