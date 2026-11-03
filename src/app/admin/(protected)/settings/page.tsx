import { CircleCheck, CircleMinus, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { AdminForm } from "@/components/admin/AdminForm";
import { Badge } from "@/components/ui/Badge";
import { adminRepository } from "@/lib/auth/admin-data";
import { getConfig } from "@/lib/config";
import { checkRpcAction, removeDemoDataAction } from "../../actions";

export const metadata = { title: "Settings" };

function Row({ name, value, ok, hint }: { name: string; value: ReactNode; ok: boolean | null; hint: string }) {
  return (
    <tr className="align-top">
      <td className="py-3 pr-4">
        <div className="font-mono text-xs text-fg">{name}</div>
        <div className="mt-1 max-w-sm text-xs text-fg-subtle">{hint}</div>
      </td>
      <td className="py-3 pr-4 text-sm break-all">{value}</td>
      <td className="py-3 text-right">
        {ok === true ? <CircleCheck className="ml-auto size-4 text-volt-400" /> : ok === false ? <TriangleAlert className="ml-auto size-4 text-amber-400" /> : <CircleMinus className="ml-auto size-4 text-fg-subtle" />}
      </td>
    </tr>
  );
}

export default async function SettingsPage() {
  const { repo } = await adminRepository();
  const cfg = getConfig();
  const demoCount = repo.demoRecordCount();

  return (
    <div>
      <p className="label text-violet-400">Admin</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 max-w-2xl text-sm text-fg-muted">
        Settings live in the <span className="font-mono text-fg">.env.local</span> file in the project folder. Edit it, then restart the app
        (stop it and run <span className="font-mono text-fg">npm run dev</span> or <span className="font-mono text-fg">npm start</span> again).
      </p>

      {cfg.problems.length > 0 && (
        <ul className="mt-6 space-y-2">
          {cfg.problems.map((p) => (
            <li key={p} className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-400">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {p}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Badge tone={cfg.cluster === "devnet" ? "amber" : "violet"}>Network: {cfg.cluster}</Badge>
        <Badge tone={cfg.paymentsLive ? "volt" : "amber"}>Payments: {cfg.paymentsLive ? "LIVE" : "TEST MODE"}</Badge>
        <Badge tone={cfg.treasuryLive ? "volt" : "amber"}>Treasury: {cfg.treasuryLive ? "LIVE" : "SIMULATED"}</Badge>
      </div>

      <section className="surface mt-6 overflow-x-auto p-5">
        <table className="w-full min-w-[640px]">
          <tbody className="divide-y divide-ink-700">
            <Row name="SOLANA_CLUSTER" value={cfg.cluster} ok={null} hint="mainnet-beta for real money, devnet to practice with free test USDC." />
            <Row
              name="SOLANA_RPC_URL"
              value={cfg.rpcIsDefault ? <span className="text-fg-muted">Public default ({cfg.rpcUrl})</span> : "Custom RPC set"}
              ok={!cfg.rpcIsDefault}
              hint="The free public RPC is rate-limited and blocks holder snapshots. A free Helius/QuickNode/Triton URL is recommended."
            />
            <Row name="TREASURY_WALLET" value={cfg.treasuryWallet ?? <span className="text-fg-muted">Not set</span>} ok={Boolean(cfg.treasuryWallet)} hint="Public address that receives fees, buys tokens, and sends rewards. Use a multisig or hardware wallet. Never put its private key here." />
            <Row name="PAYMENTS_MODE" value={cfg.paymentsLive ? "live" : "test"} ok={cfg.paymentsLive} hint="live = applicants pay real USDC (verified on-chain). test = simulated payments." />
            <Row name="TREASURY_MODE" value={cfg.treasuryLive ? "live" : "test"} ok={cfg.treasuryLive} hint="live = Jupiter purchases and on-chain reward transfers signed by the treasury wallet." />
            <Row name="RUNNER_MINT" value={cfg.runnerMint ?? <span className="text-fg-muted">Not set (token not launched)</span>} ok={Boolean(cfg.runnerMint)} hint="Mint address of the RUNNER token. Enables live balances and on-chain snapshots." />
            <Row name="RUNNER_EXCLUDED_WALLETS" value={`${cfg.excludedWallets.length} wallet(s)`} ok={null} hint="Comma-separated wallets excluded from snapshots (LP pools, team, burn). The treasury is always excluded." />
            <Row name="SWAP_SLIPPAGE_BPS" value={`${cfg.slippageBps} (${cfg.slippageBps / 100}%)`} ok={null} hint="Maximum slippage for Jupiter treasury purchases." />
            <Row name="DISTRIBUTION_BATCH_SIZE" value={cfg.distributionBatchSize} ok={null} hint="Recipients per transaction (1–8). Each batch is one wallet approval." />
          </tbody>
        </table>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="text-sm font-semibold">Connection check</h2>
          <p className="mt-2 text-sm text-fg-muted">Confirms the server can reach your Solana RPC.</p>
          <AdminForm action={checkRpcAction} submitLabel="Test RPC connection" submitVariant="secondary" className="mt-4" />
        </section>
        <section className="surface p-5">
          <h2 className="text-sm font-semibold">Demo data</h2>
          <p className="mt-2 text-sm text-fg-muted">
            {demoCount > 0 ? `${demoCount} fictional sample records are loaded. Remove them before launch so only real projects appear.` : "No demo data is loaded."}
          </p>
          {demoCount > 0 && (
            <AdminForm
              action={removeDemoDataAction}
              submitLabel="Remove all demo data"
              submitVariant="danger"
              className="mt-4"
              confirm={{ title: "Remove all demo data?", body: "Deletes every fictional sample project, campaign, and distribution. Real records are kept. This can't be undone.", confirmLabel: "Remove", tone: "danger" }}
            />
          )}
        </section>
      </div>
    </div>
  );
}
