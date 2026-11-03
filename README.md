# RUNNER

**Discover the Next Runner.** A curated Solana memecoin rewards platform.

Projects apply and pay a USDC campaign fee. RUNNER screens every project independently. For approved campaigns, part of the fee buys the project's token, and those tokens are distributed pro-rata to eligible RUNNER holders. The rest goes to operations and the treasury reserve. Bigger packages put more into token purchases:

| Package | Fee | Token purchases | Operations | Reserve | Recommended market cap |
| --- | --- | --- | --- | --- | --- |
| Starter | $500 | 70% | 20% | 10% | $10K–$50K |
| Growth | $750 | 80% | 15% | 5% | $50K–$100K |
| Featured | $2,000 | 90% | 7.5% | 2.5% | $100K+ |

> Campaign participation does not guarantee token appreciation, liquidity, profits, or successful project outcomes. Fictional sample projects are labeled **DEMO DATA**.

## Quick start (no accounts needed)

1. Install **Node.js 22.13 or newer** (LTS) from <https://nodejs.org>.
2. In the project folder, run:
   ```bash
   npm install
   npm run setup     # creates .env.local and prints your admin password
   npm run dev       # open http://localhost:3000
   ```
3. Admin panel: <http://localhost:3000/admin>. Sign in with `admin` and the password `npm run setup` printed.

All data is saved in one file, `data/runner.db` (SQLite, built into Node). There's no database server to install. **Back up this file**: it holds your real applications, payments, and distributions.

## Going live, step by step

Everything starts in **TEST MODE**. Switch features on one at a time by editing `.env.local`, then restart the app. The admin **Settings** page shows what's active.

| Step | Setting(s) in `.env.local` | What it enables |
| --- | --- | --- |
| 1. Practice on devnet | `SOLANA_CLUSTER=devnet` | Free test network with test USDC (devnet faucets). Recommended first. |
| 2. Reliable RPC | `SOLANA_RPC_URL=https://…` | A free Helius, QuickNode, or Triton URL. Needed for holder snapshots. |
| 3. Treasury address | `TREASURY_WALLET=<public address>` | Receives fees, buys tokens, sends rewards. Use a hardware wallet or a Squads multisig. **Never paste a private key anywhere.** |
| 4. Real payments | `PAYMENTS_MODE=live` | Applicants pay USDC from their wallet. Each payment is verified on-chain (exact amount to the treasury, `RUNNER:<reference>` memo, no reuse). |
| 5. Real treasury | `TREASURY_MODE=live` | Admin buys the project token through Jupiter and sends rewards in batches, signing each step with the treasury wallet in the browser. |
| 6. RUNNER token | `RUNNER_MINT=<mint>` and `RUNNER_EXCLUDED_WALLETS=…` | Live holder balances on the dashboard and one-click on-chain snapshots. |

Before you turn on real payments, get advice from a crypto-aware lawyer. Collecting fees and distributing tokens can raise securities and money-transmission questions.

## How a campaign runs (admin)

1. **Application.** The project applies and pays (verified on-chain in live mode).
2. **Screening.** Click **Fetch on-chain data**. This reads mint and freeze authority, supply, the largest holders, and DexScreener liquidity, market cap, and volume, then pre-fills the screening form. Score the 8 criteria, add flags and notes, then approve or reject.
3. **Campaign.** Create it from the approved application. The package's split is fixed when the campaign is created.
4. **Purchase.** Get a Jupiter quote and sign with the treasury wallet. The server broadcasts the swap and verifies the treasury's balance changes. You can also paste the signature of a swap you made on jup.ag.
5. **Snapshot.** Take an on-chain snapshot of every RUNNER holder, or import a CSV (`wallet,balance`). Excluded wallets are removed.
6. **Distribute.** Create the plan. Amounts are pro-rata and rounded down, so the total never exceeds what was purchased. Then **Send all**: one wallet approval per batch of 5. Each batch is saved *before* it's broadcast and checked recipient by recipient afterwards, so a crash can never pay anyone twice. If a send is interrupted, **Check pending** resolves it.

Use **Export CSV** in the campaign's Distribution panel to download every recipient, including rows beyond the 200 shown on screen. The export includes full wallet addresses, snapshot IDs, exact raw and decimal token amounts, statuses, transaction signatures, and data sources. A planned or simulated row does not mean tokens were sent. When importing into a spreadsheet, set raw amounts and identifiers to text to preserve every digit.

**The server never holds a private key.** It builds transactions, your wallet signs them, and the server submits and verifies them.

## Running it for real (hosting)

`npm run build && npm start` runs on any machine that stays on: a VPS, Railway, Render, or Fly.io. It needs a **persistent disk** for `data/runner.db`. Serverless hosts with no persistent disk, like Vercel, won't keep the database. A `Dockerfile` is included. Mount a volume at `/app/data`.

## Development

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Unit tests: economics, rewards, transaction verification, repository lifecycle |
| `npm run test:smoke` | After a build: start a temporary local server and check public/admin pages and CSV export access/content using an isolated demo database |
| `npm run verify` | Typecheck, lint, test, and build |

The smoke check forces simulated payments and treasury operations on its own temporary database and deletes that database afterwards. It does not test browser wallet signing or send on-chain transactions. CI runs it after the production build.

Code map:
- `src/lib/economics`: per-package fee allocation and proportional rewards (bigint, snapshot-based)
- `src/lib/solana/server.ts`: all RPC, DexScreener, and Jupiter calls, plus transaction building
- `src/lib/solana/verify.ts`: pure on-chain verification of payments, swaps, and transfers (unit-tested)
- `src/lib/data/store.ts`: SQLite persistence
- `src/lib/data/runner-repository.ts`: all business rules
- `src/app/admin/actions.ts`: admin server actions, each one authorized server-side
- `src/app/(site)/submit/actions.ts`: public application and payment actions

Security: admin is checked in the proxy, the layout, every page, and every action. The admin cookie is signed with HMAC, `httpOnly`, `SameSite=Strict`, and scoped to `/admin`. Login attempts are throttled. Nothing secret reaches the browser.
