import { Activity, ArrowRight, Coins, Layers, ScanSearch } from "lucide-react";
import { CampaignCard } from "@/components/campaign/CampaignCard";
import { AllocationExplainer, HowItWorksSteps, TrustSection } from "@/components/home/Sections";
import { HeroFlow } from "@/components/home/HeroFlow";
import { Container, SectionHeading } from "@/components/layout/PageHeader";
import { SourceBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { StatisticsCard } from "@/components/ui/StatisticsCard";
import { getRepositoryForRequest } from "@/lib/data";
import { formatInt } from "@/lib/format";

export default async function HomePage() {
  const repo = await getRepositoryForRequest();
  const [stats, campaigns] = await Promise.all([repo.getPlatformStats(), repo.listCampaigns({ sort: "recent" })]);

  const featured = [
    ...campaigns.filter((c) => c.featured),
    ...campaigns.filter((c) => !c.featured && c.status === "active"),
    ...campaigns.filter((c) => !c.featured && c.status !== "active"),
  ].slice(0, 3);
  const heroCampaign = featured[0];

  return (
    <>
      {/* HERO */}
      <section className="relative -mt-16 overflow-hidden pt-16">
        <div aria-hidden className="grid-bg absolute inset-0" />
        <div aria-hidden className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(139_92_246/0.18),transparent)]" />
        <Container className="relative grid gap-14 pb-20 pt-16 sm:pt-24 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16 lg:pb-28">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-sm border border-ink-600 bg-ink-850/80 px-2.5 py-1 text-xs text-fg-muted">
              <span className="size-1.5 rounded-full bg-volt-400 shadow-[0_0_10px_2px_rgb(76_247_166/0.6)]" aria-hidden />
              Curated Solana token distributions
            </span>
            <h1 className="mt-6 text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[68px]">
              Discover the <span className="text-gradient">Next Runner.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-fg-muted">
              One token. Multiple opportunities. Discover emerging Solana projects through curated token distributions.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/explore" size="lg">
                Explore Campaigns <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="/submit" size="lg" variant="secondary">
                Submit Your Project
              </ButtonLink>
            </div>
            <p className="mt-6 max-w-lg text-xs leading-relaxed text-fg-subtle">
              Participation does not guarantee token appreciation, liquidity, or profits. Screening is not an endorsement.
            </p>
          </div>
          {heroCampaign && <HeroFlow campaign={heroCampaign} />}
        </Container>
      </section>

      {/* STATS */}
      <section aria-labelledby="stats-heading">
        <Container>
          <div className="flex items-center justify-between">
            <h2 id="stats-heading" className="label">
              Platform statistics
            </h2>
            <SourceBadge source={stats.source} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatisticsCard label="Total campaigns" value={formatInt(stats.totalCampaigns)} icon={Layers} />
            <StatisticsCard label="Projects reviewed" value={formatInt(stats.projectsReviewed)} icon={ScanSearch} hint="Approved + rejected" />
            <StatisticsCard label="Tokens distributed" value={formatInt(stats.tokensDistributed)} icon={Coins} accent="volt" hint="Distinct project tokens" />
            <StatisticsCard label="Active campaigns" value={formatInt(stats.activeCampaigns)} icon={Activity} accent="volt" />
          </div>
        </Container>
      </section>

      {/* FEATURED */}
      <section className="mt-24">
        <Container>
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading
              eyebrow="Featured campaigns"
              title="Screened. Allocated. Disclosed."
              description="Each campaign shows its numbers at screening time, its reward allocation, and its risk assessment."
            />
            <ButtonLink href="/explore" variant="secondary">
              View all campaigns <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        </Container>
      </section>

      <section className="mt-28">
        <Container>
          <HowItWorksSteps />
        </Container>
      </section>

      <section className="mt-28">
        <Container>
          <AllocationExplainer />
        </Container>
      </section>

      <section className="mt-28">
        <Container>
          <TrustSection />
        </Container>
      </section>

      {/* CTA */}
      <section className="mt-28">
        <Container>
          <div className="relative overflow-hidden rounded-lg border border-ink-600 bg-ink-850 px-6 py-12 sm:px-12">
            <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(76_247_166/0.14),transparent)]" />
            <div aria-hidden className="absolute -bottom-32 left-10 size-80 rounded-full bg-[radial-gradient(closest-side,rgb(139_92_246/0.18),transparent)]" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Building on Solana?</h2>
                <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">
                  Apply for a campaign and put your token in front of holders looking for early-stage projects. Every application is screened
                  independently — approval is never guaranteed.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/submit" size="lg" variant="volt">
                  Submit Your Project
                </ButtonLink>
                <ButtonLink href="/how-it-works#screening" size="lg" variant="secondary">
                  Screening criteria
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
