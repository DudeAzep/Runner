import type { Metadata } from "next";
import { AllocationExplainer, HowItWorksSteps, RewardFormula, TrustSection } from "@/components/home/Sections";
import { Container, PageHeader, SectionHeading } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { SCREENING_CRITERIA } from "@/lib/types";

export const metadata: Metadata = { title: "How It Works" };

export default function HowItWorksPage() {
  return (
    <Container>
      <PageHeader
        eyebrow="Protocol overview"
        title="How RUNNER works"
        description="RUNNER connects emerging Solana projects with holders interested in early-stage discovery. Projects pay for a campaign; RUNNER screens independently; approved campaigns fund token purchases that are distributed to RUNNER holders."
        actions={
          <>
            <ButtonLink href="/explore">Explore campaigns</ButtonLink>
            <ButtonLink href="/submit" variant="secondary">
              Submit a project
            </ButtonLink>
          </>
        }
      />

      <div className="mt-6">
        <HowItWorksSteps />
      </div>

      <section id="screening" className="mt-24 scroll-mt-24">
        <SectionHeading
          eyebrow="Screening"
          title="Eight criteria, scored independently"
          description="Each criterion is scored 0–10 (10 = strongest / lowest risk). Reviewers record risk flags and notes, which are published with every approved campaign. Paying a fee never changes the outcome."
        />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SCREENING_CRITERIA.map((c, i) => (
            <div key={c.key} className="surface p-5">
              <span className="font-mono text-xs text-fg-subtle">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 text-sm font-semibold">{c.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{c.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-24">
        <AllocationExplainer />
      </section>

      <section className="mt-24 grid gap-6 lg:grid-cols-2">
        <RewardFormula />
        <div className="surface p-6">
          <h3 className="text-[15px] font-semibold">Snapshot-based eligibility</h3>
          <ol className="mt-5 space-y-4 text-sm text-fg-muted">
            {[
              ["Announce", "Each campaign publishes its snapshot time before distribution."],
              ["Snapshot", "RUNNER balances are read at a single Solana slot. Transfers after the snapshot don't change eligibility."],
              ["Exclude", "Treasury, liquidity pool, burn, and team wallets are removed from eligible supply."],
              ["Calculate", "Each wallet's share is its balance ÷ eligible supply, applied to the purchased reward tokens."],
              ["Distribute", "Rewards are sent and each transfer is recorded with its on-chain signature once verified."],
            ].map(([t, b], i) => (
              <li key={t} className="flex gap-3">
                <span className="tabular inline-flex size-6 shrink-0 items-center justify-center rounded-sm border border-ink-600 font-mono text-xs text-fg">
                  {i + 1}
                </span>
                <span>
                  <span className="font-medium text-fg">{t}.</span> {b}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mt-24">
        <TrustSection />
      </section>
    </Container>
  );
}
