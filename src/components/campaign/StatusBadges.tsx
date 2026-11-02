import { Badge, type Tone } from "@/components/ui/Badge";
import type { ApplicationStatus, CampaignStatus, RiskLevel } from "@/lib/types";

const CAMPAIGN: Record<CampaignStatus, { label: string; tone: Tone }> = {
  active: { label: "Live", tone: "volt" },
  upcoming: { label: "Upcoming", tone: "violet" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "rose" },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const s = CAMPAIGN[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

const APPLICATION: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  submitted: { label: "Submitted", tone: "sky" },
  under_review: { label: "Under review", tone: "amber" },
  approved: { label: "Approved", tone: "volt" },
  rejected: { label: "Rejected", tone: "rose" },
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const s = APPLICATION[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

/** Screening outcome shown on public campaign surfaces. */
export function ScreeningStatusBadge({ passed = true }: { passed?: boolean }) {
  return passed ? <Badge tone="volt">Screening passed</Badge> : <Badge tone="rose">Screening failed</Badge>;
}

const RISK: Record<RiskLevel, { label: string; tone: Tone }> = {
  low: { label: "Low risk", tone: "volt" },
  moderate: { label: "Moderate risk", tone: "sky" },
  elevated: { label: "Elevated risk", tone: "amber" },
  high: { label: "High risk", tone: "rose" },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const r = RISK[level];
  return (
    <Badge tone={r.tone} title="RUNNER screening risk assessment. All memecoins carry substantial risk.">
      {r.label}
    </Badge>
  );
}

export const riskLabel = (l: RiskLevel) => RISK[l].label;
export const campaignStatusLabel = (s: CampaignStatus) => CAMPAIGN[s].label;
