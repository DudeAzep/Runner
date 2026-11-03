import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/layout/PageHeader";
import { getPublicConfig } from "@/lib/config";
import { getRepositoryForRequest } from "@/lib/data";
import { DEMO_ELIGIBLE_SUPPLY, DEMO_RUNNER_BALANCE, DEMO_WALLET } from "@/lib/data/demo-seed";
import { HolderDashboard, type DashboardCampaign } from "./HolderDashboard";
import { fetchWalletDistributions } from "./actions";

export const metadata: Metadata = { title: "Holder Dashboard" };

export default async function DashboardPage() {
  const repo = await getRepositoryForRequest();
  const campaigns = repo.listCampaigns();
  const demoDist = await fetchWalletDistributions(DEMO_WALLET);

  const eligible: DashboardCampaign[] = campaigns
    .filter((c) => c.status === "active" || c.status === "upcoming")
    .map((c) => ({
      slug: c.slug,
      projectName: c.projectName,
      ticker: c.ticker,
      status: c.status,
      rewardAllocationCents: c.rewardAllocationCents,
      snapshotAt: c.snapshotAt,
      source: c.source,
    }));

  const participated = campaigns
    .filter((c) => c.status === "completed")
    .map((c) => ({ slug: c.slug, projectName: c.projectName, ticker: c.ticker, snapshotAt: c.snapshotAt, rewardAllocationCents: c.rewardAllocationCents }));

  return (
    <Container>
      <PageHeader
        eyebrow="Holder dashboard"
        title="Your RUNNER dashboard"
        description="Track eligible campaigns, estimate proportional rewards, and review distribution history for your wallet."
      />
      <HolderDashboard
        cluster={getPublicConfig().cluster}
        eligibleCampaigns={eligible}
        demo={{
          wallet: DEMO_WALLET,
          runnerBalance: DEMO_RUNNER_BALANCE,
          eligibleSupply: DEMO_ELIGIBLE_SUPPLY,
          distributions: demoDist.items,
          participated,
        }}
      />
    </Container>
  );
}
