"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { CheckCircle2, CircleCheck, Copy, CreditCard, FlaskConical, LoaderCircle, ShieldAlert } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import { ApplicationStatusBadge } from "@/components/campaign/StatusBadges";
import { PayWithWallet } from "@/components/wallet/PayWithWallet";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { calculateCampaignAllocation, CAMPAIGN_PACKAGES, PACKAGE_IDS, type CampaignPackageId } from "@/lib/economics/allocation";
import { formatDateTime, formatUsdCents } from "@/lib/format";
import { applicationSchema } from "@/lib/validation/schemas";
import { submitApplication, type SubmitState } from "./actions";

type FieldName = keyof typeof applicationSchema.shape;

function Field({
  name,
  label,
  error,
  hint,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="flex items-center justify-between text-sm font-medium text-fg">
        <span>
          {label} <span className="text-rose-400">*</span>
        </span>
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${name}-error`} className="mt-1.5 text-xs text-rose-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="surface p-5 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center gap-3">
        <span className="tabular inline-flex size-7 items-center justify-center rounded-md border border-violet-500/30 bg-violet-500/10 font-mono text-xs text-violet-300">
          {step}
        </span>
        <h2 className="text-[15px] font-semibold">{title}</h2>
      </div>
      <div className="mt-6 space-y-5">{children}</div>
    </fieldset>
  );
}

interface PaymentConfig {
  paymentsLive: boolean;
  cluster: "mainnet-beta" | "devnet";
  /** Preselected package, e.g. from /submit?package=starter. */
  initialPackage?: CampaignPackageId;
}

export function SubmitForm(props: PaymentConfig) {
  const [formKey, setFormKey] = useState(0);
  return <SubmitFormInner key={formKey} onReset={() => setFormKey((k) => k + 1)} {...props} />;
}

function SubmitFormInner({ onReset, paymentsLive, cluster, initialPackage }: { onReset: () => void } & PaymentConfig) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitApplication, { status: "idle" });
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [pkg, setPkg] = useState<CampaignPackageId>(initialPackage ?? "growth");
  const [paid, setPaid] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const { publicKey } = useWallet();

  if (state.status === "success") return <Confirmation state={state} onReset={onReset} cluster={cluster} />;

  const values = state.status === "error" ? state.values : {};
  const serverErrors = state.status === "error" ? state.fieldErrors : {};
  const err = (n: string) => clientErrors[n] ?? serverErrors[n];

  const validate = (name: FieldName, value: string) => {
    const schema = applicationSchema.shape[name];
    const r = schema.safeParse(value);
    setClientErrors((e) => {
      const next = { ...e };
      if (r.success) delete next[name];
      else next[name] = r.error.issues[0]?.message ?? "Invalid value";
      return next;
    });
  };

  const input = (name: FieldName, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={name}
      name={name}
      required
      defaultValue={values[name] ?? ""}
      aria-invalid={err(name) ? true : undefined}
      aria-describedby={err(name) ? `${name}-error` : undefined}
      onBlur={(e) => e.currentTarget.value && validate(name, e.currentTarget.value)}
      className="field"
      autoComplete="off"
      spellCheck={false}
      {...props}
    />
  );

  const selected = CAMPAIGN_PACKAGES[pkg];
  const alloc = calculateCampaignAllocation(selected.feeUsdCents);

  const simulatePayment = () => {
    setPaying(true);
    setTimeout(() => {
      const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
      setPaid(`TEST-${rand}`);
      setPaying(false);
    }, 900);
  };

  return (
    <form action={action} noValidate className="space-y-6">
      {state.status === "error" && (
        <div role="alert" className="rounded-md border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-400">
          {state.message}
        </div>
      )}

      <Section step={1} title="Project details">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="projectName" label="Project name" error={err("projectName")}>
            {input("projectName", { placeholder: "e.g. MoonRunner", maxLength: 60 })}
          </Field>
          <Field name="ticker" label="Token ticker" error={err("ticker")} hint="2–10 letters or numbers, without $">
            {input("ticker", { placeholder: "MRUN", maxLength: 11, className: "field font-mono uppercase" })}
          </Field>
        </div>
        <Field name="contractAddress" label="Solana contract address" error={err("contractAddress")} hint="The token's SPL mint address (base58).">
          {input("contractAddress", { placeholder: "Token mint address", className: "field font-mono text-[13px]" })}
        </Field>
        <Field name="description" label="Project description" error={err("description")} hint="40–2,000 characters. What it is, who's building it, and why it matters.">
          <textarea
            id="description"
            name="description"
            required
            rows={5}
            maxLength={2000}
            defaultValue={values.description ?? ""}
            aria-invalid={err("description") ? true : undefined}
            onBlur={(e) => e.currentTarget.value && validate("description", e.currentTarget.value)}
            className="field resize-y"
            placeholder="Describe the project…"
          />
        </Field>
      </Section>

      <Section step={2} title="Links">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="website" label="Project website" error={err("website")}>
            {input("website", { type: "url", placeholder: "https://", inputMode: "url" })}
          </Field>
          <Field name="twitter" label="X / Twitter URL" error={err("twitter")}>
            {input("twitter", { type: "url", placeholder: "https://x.com/…", inputMode: "url" })}
          </Field>
          <Field name="telegram" label="Telegram URL" error={err("telegram")}>
            {input("telegram", { type: "url", placeholder: "https://t.me/…", inputMode: "url" })}
          </Field>
          <Field name="discord" label="Discord URL" error={err("discord")}>
            {input("discord", { type: "url", placeholder: "https://discord.gg/…", inputMode: "url" })}
          </Field>
        </div>
      </Section>

      <Section step={3} title="Applicant">
        <Field name="applicantWallet" label="Applicant wallet address" error={err("applicantWallet")} hint="Solana wallet used to contact you about this application.">
          <input
            key={publicKey?.toBase58() ?? "none"}
            id="applicantWallet"
            name="applicantWallet"
            required
            defaultValue={values.applicantWallet || publicKey?.toBase58() || ""}
            aria-invalid={err("applicantWallet") ? true : undefined}
            aria-describedby={err("applicantWallet") ? "applicantWallet-error" : undefined}
            onBlur={(e) => e.currentTarget.value && validate("applicantWallet", e.currentTarget.value)}
            placeholder="Your Solana wallet"
            className="field font-mono text-[13px]"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        {publicKey && <p className="-mt-3 text-xs text-volt-400">Prefilled from your connected wallet.</p>}
      </Section>

      <Section step={4} title="Campaign package">
        <div id="package" role="radiogroup" aria-label="Campaign package" className="grid gap-3 md:grid-cols-3">
          {PACKAGE_IDS.map((id) => {
            const p = CAMPAIGN_PACKAGES[id];
            const a = calculateCampaignAllocation(p.feeUsdCents);
            const on = pkg === id;
            return (
              <label
                key={id}
                className={cn(
                  "relative flex cursor-pointer flex-col rounded-md border p-4 transition",
                  on ? "border-violet-500 bg-violet-500/[0.07] shadow-[0_0_0_1px_rgb(139_92_246/0.5)]" : "border-ink-600 bg-ink-900 hover:border-ink-500",
                )}
              >
                <input
                  type="radio"
                  name="campaignPackage"
                  value={id}
                  checked={on}
                  onChange={() => {
                    setPkg(id);
                    setPaid(null);
                  }}
                  className="sr-only"
                />
                <span className="flex items-center justify-between">
                  <span className="label text-fg-muted">{p.name}</span>
                  {on && <CircleCheck className="size-4 text-violet-400" aria-hidden />}
                </span>
                <span className="tabular mt-2 text-2xl font-semibold tracking-tight">
                  {formatUsdCents(p.feeUsdCents)} <span className="text-sm font-normal text-fg-subtle">USDC</span>
                </span>
                <span className="mt-1 text-xs text-fg-muted">{p.summary}</span>
                <span className="mt-2 text-xs text-fg-muted">
                  Recommended market cap: <span className="tabular font-medium text-fg">{p.recommendedMarketCap}</span>
                </span>
                <span className="tabular mt-3 text-xs text-volt-400">{formatUsdCents(a.rewardUsdCents)} reward pool if approved</span>
              </label>
            );
          })}
        </div>
      </Section>

      {paymentsLive ? (
        <div className="rounded-lg border border-violet-500/40 bg-violet-500/[0.06] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-violet-300" aria-hidden />
            <h2 className="text-[15px] font-semibold">Campaign fee payment · {formatUsdCents(alloc.totalUsdCents)} USDC</h2>
            {cluster === "devnet" && <Badge tone="amber">DEVNET</Badge>}
          </div>
          <p className="mt-3 text-sm text-fg-muted">
            After you submit, you&apos;ll pay the fee in USDC from your Solana wallet. The payment is verified on-chain before screening
            begins. If approved, {formatUsdCents(alloc.rewardUsdCents)} (70%) is used to buy your token for RUNNER holders.
          </p>
        </div>
      ) : (
      <fieldset className="relative overflow-hidden rounded-lg border border-dashed border-amber-400/40 bg-amber-400/[0.03] p-5 sm:p-6">
        <legend className="sr-only">Simulated payment</legend>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-amber-400" aria-hidden />
            <h2 className="text-[15px] font-semibold">Campaign fee payment</h2>
          </div>
          <Badge tone="amber">
            <FlaskConical className="size-3" /> TEST MODE — NO REAL PAYMENT
          </Badge>
        </div>
        <p className="mt-3 text-sm text-fg-muted">
          This MVP does not collect funds. The button below simulates a USDC payment authorization so the full flow can be tested. No
          wallet signature is requested and nothing is charged.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-fg-subtle">Package</dt>
              <dd className="mt-0.5 font-medium">{selected.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-subtle">Fee</dt>
              <dd className="mt-0.5 font-medium">{formatUsdCents(alloc.totalUsdCents)} USDC</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-subtle">70% purchases</dt>
              <dd className="mt-0.5 font-medium text-volt-400">{formatUsdCents(alloc.rewardUsdCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-subtle">20% / 10%</dt>
              <dd className="mt-0.5 font-medium text-fg-muted">
                {formatUsdCents(alloc.operationsUsdCents)} / {formatUsdCents(alloc.reserveUsdCents)}
              </dd>
            </div>
          </dl>
          {paid ? (
            <div className="inline-flex items-center gap-2 rounded-md border border-volt-400/30 bg-volt-400/10 px-3 py-2 text-sm text-volt-400" role="status">
              <CheckCircle2 className="size-4" /> Simulated · {paid}
            </div>
          ) : (
            <Button type="button" variant="secondary" onClick={simulatePayment} disabled={paying} className="border-amber-400/40">
              {paying ? <LoaderCircle className="size-4 animate-spin" /> : <FlaskConical className="size-4 text-amber-400" />}
              Simulate {formatUsdCents(alloc.totalUsdCents)} USDC payment
            </Button>
          )}
        </div>
        <input type="hidden" name="testPaymentConfirmed" value={paid ? "yes" : ""} />
        {serverErrors.payment && !paid && <p className="mt-3 text-xs text-rose-400">{serverErrors.payment}</p>}
      </fieldset>
      )}

      <div className="surface p-5 sm:p-6">
        <label className="flex items-start gap-3 text-sm text-fg-muted">
          <input type="checkbox" name="acceptTerms" required className="mt-0.5 size-4 accent-violet-500" />
          <span>
            I understand that submitting an application does not guarantee approval, that all projects undergo independent screening, and
            that campaign fees do not purchase a guaranteed endorsement or approval.
          </span>
        </label>
        {err("acceptTerms") && <p className="mt-2 text-xs text-rose-400">{err("acceptTerms")}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-fg-subtle">Fields marked * are required.</p>
          <Button type="submit" size="lg" disabled={pending || (!paymentsLive && !paid)}>
            {pending && <LoaderCircle className="size-4 animate-spin" />}
            {pending ? "Submitting…" : "Submit application"}
          </Button>
        </div>
        {!paymentsLive && !paid && <p className="mt-3 text-right text-xs text-amber-400">Complete the TEST MODE payment step to enable submission.</p>}
      </div>
    </form>
  );
}

function Confirmation({
  state,
  onReset,
  cluster,
}: {
  state: Extract<SubmitState, { status: "success" }>;
  onReset: () => void;
  cluster: "mainnet-beta" | "devnet";
}) {
  const awaiting = state.paymentStatus === "awaiting_payment";
  const [copied, setCopied] = useState(false);
  return (
    <div className="surface animate-fade-up p-6 sm:p-10" role="status">
      <div className="flex size-12 items-center justify-center rounded-md border border-volt-400/30 bg-volt-400/10">
        <CheckCircle2 className="size-6 text-volt-400" />
      </div>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight">Application received</h2>
      <p className="mt-2 max-w-xl text-sm text-fg-muted">
        {state.projectName} (${state.ticker}) has been submitted for independent screening. Save your reference number to check its status.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-ink-600 bg-ink-900 p-4 sm:col-span-1">
          <div className="label">Reference number</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-xl font-semibold tracking-wider text-violet-300">{state.reference}</span>
            <button
              type="button"
              aria-label="Copy reference"
              className="text-fg-subtle hover:text-fg"
              onClick={() => {
                void navigator.clipboard?.writeText(state.reference);
                setCopied(true);
              }}
            >
              {copied ? <CircleCheck className="size-4 text-volt-400" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>
        <div className="rounded-md border border-ink-600 bg-ink-900 p-4">
          <div className="label">Status</div>
          <div className="mt-2">
            <ApplicationStatusBadge status="submitted" />
          </div>
        </div>
        <div className="rounded-md border border-ink-600 bg-ink-900 p-4">
          <div className="label">Package · Payment</div>
          <div className="mt-2 text-sm">
            {CAMPAIGN_PACKAGES[state.campaignPackage].name} ·{" "}
            {awaiting ? <span className="text-violet-300">Awaiting payment</span> : <span className="text-amber-400">TEST MODE (simulated)</span>}
          </div>
        </div>
      </div>

      {awaiting && (
        <div className="mt-6">
          <PayWithWallet reference={state.reference} amountUsd={(CAMPAIGN_PACKAGES[state.campaignPackage].feeUsdCents / 100).toFixed(2)} cluster={cluster} />
        </div>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-md border border-ink-700 bg-ink-900/60 p-4 text-sm text-fg-muted">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-violet-400" />
        <p>
          Submitted {formatDateTime(state.createdAt)}. Screening typically reviews liquidity, holder concentration, token authorities, and
          manipulation indicators. Approval is not guaranteed.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={`/status?ref=${state.reference}`}>Track application status</ButtonLink>
        <ButtonLink href="/explore" variant="secondary">
          Explore campaigns
        </ButtonLink>
        <button type="button" className="inline-flex items-center px-2 text-sm text-fg-muted hover:text-fg" onClick={() => {
            onReset();
            window.scrollTo({ top: 0 });
          }}>
          Submit another project
        </button>
      </div>
    </div>
  );
}
