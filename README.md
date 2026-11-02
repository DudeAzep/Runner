# RUNNER

**Discover the Next Runner.** A curated Solana memecoin rewards platform.

Solana projects apply for promotional campaigns and pay a USDC fee. RUNNER screens each one independently. For approved campaigns, **70%** of the fee buys the project's token, and those tokens go to eligible RUNNER holders in proportion to their balance. **20%** funds operations and **10%** goes to the treasury reserve.

> **MVP status:** All sample projects are **fictional DEMO DATA**. Payments are simulated (**TEST MODE**). No on-chain purchases or distributions are made. Campaign participation does not guarantee token appreciation, liquidity, profits, or successful project outcomes.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack, Server Actions), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4 (CSS-first tokens in `src/app/globals.css`), Geist Sans / Mono (self-hosted) |
| Data | Supabase (Postgres + Auth + RLS), with a built-in in-memory demo store when Supabase isn't configured |
| Wallets | Solana Wallet Adapter (Wallet Standard auto-detection: Phantom, Solflare, Backpack, …). Read-only. |
| Validation | Zod (shared client + server schemas), base58/32-byte Solana address checks |
| Icons | Lucide |
| Tests | Node test runner via `tsx` (economics, rewards, validation) |

## Quick start

```bash
npm install
cp .env.example .env.local     # set ADMIN_PASSWORD (12+ chars) and ADMIN_SESSION_SECRET (32+ chars)
npm run dev                     # http://localhost:3000
```

With no Supabase keys, the app runs on the **in-memory demo store**, which is seeded from `src/lib/data/demo-seed.ts`. Admin actions work, but their changes are lost when the server restarts.

Admin: `http://localhost:3000/admin`. In demo mode, sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run test` | Unit tests for allocation math, proportional rewards, validation |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint (next core-web-vitals + TS) |
| `npm run verify` | typecheck + lint + test + build (also runs in CI) |
| `npm run db:seed:generate` | Regenerates `supabase/seed.sql` from the demo seed |

## Connecting Supabase

1. Create a Supabase project.
2. Apply the schema. You can paste `supabase/migrations/20261101000000_init_runner.sql` into the SQL editor, or with the Supabase CLI run `supabase link` and then `supabase db push`.
3. Optional: load the demo data from `supabase/seed.sql`. Every row is marked `is_demo = true`.
4. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. **Never** give the service-role key a `NEXT_PUBLIC_` prefix.
5. Create an admin. Sign up a user in **Auth → Users**, then run:

   ```sql
   insert into public.users (auth_user_id, role)
   values ('<auth-user-uuid>', 'admin');
   ```

Once all three Supabase variables are set, the app uses Supabase automatically (`src/lib/data/index.ts`).

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Landing page with hero, platform stats, featured campaigns, how it works, 70/20/10 allocation, trust and transparency, and the risk disclosure |
| `/explore` | Campaign marketplace. Filters: All, Approved (live), Upcoming, Completed. Sorts: recently approved, market cap, allocation. Plus search |
| `/campaigns/[slug]` | Project info, screening report, token info, campaign economics, treasury purchases, distribution info |
| `/submit` | Application form with client and server validation, packages, TEST MODE payment, and a reference number on submit |
| `/status?ref=RUN-XXXXXX` | Application status timeline |
| `/dashboard` | Holder dashboard: connect or disconnect a wallet, preview with a demo wallet, reward estimator, distributions, activity |
| `/how-it-works` | Screening criteria, allocation, reward formula, snapshot process |
| `/admin` | Protected. Overview, application management, screening, campaign management |

## Architecture

```
src/
  app/
    (site)/              public site (Navbar + Footer + wallet provider)
    admin/(protected)/   admin UI — layout + every page re-check auth server-side
    admin/actions.ts     server actions — each one authorizes before touching data
  components/            brand, layout, campaign (CampaignCard, CampaignStatusBadge, ProjectLogo, …),
                         ui (StatisticsCard, Badge, AddressChip, Button), wallet (WalletConnectButton), admin
  lib/
    economics/           allocation.ts (70/20/10) · rewards.ts (proportional, snapshot-based) + tests
    data/                RunnerRepository interface · DemoRepository · SupabaseRepository · demo-seed
    auth/                admin session (Supabase Auth or signed cookie) · data-access guard
    supabase/            server/session/public clients · service client (server-only)
    validation/          zod schemas · Solana address helpers
  proxy.ts               early redirect for /admin/* (Next 16 "proxy", formerly middleware)
supabase/
  migrations/            schema, constraints, indexes, triggers, RLS
  seed.sql               generated demo data
```

### Campaign economics

`calculateCampaignAllocation(cents)` does all of its math in integer USDC cents. The reward and operations shares are rounded down, and the reserve gets the remainder, so the three parts always add up exactly to the fee. A $1,000 campaign always splits into $700, $200, and $100. The database stores the splits as **generated columns** with the same formula, and a trigger stops treasury purchases from going over the 70% allocation.

### Proportional rewards

```
share  = holder_eligible_balance / total_eligible_balance
reward = share × campaign_reward_pool
```

`src/lib/economics/rewards.ts` works on `bigint` base units. It rejects negative balances, zero supply, and a balance larger than supply. Amounts are rounded down, so the total paid out can never exceed the pool. `buildDistributionPlan()` takes a snapshot, removes excluded wallets (treasury, LP, team), applies a minimum balance and a minimum payout, and returns the leftover "dust" explicitly. It always holds that `allocated + undistributed === pool`. This module only does math. It never sends transactions.

### Data provenance

Every campaign, application, purchase, and distribution has a source of `demo` or `verified`. The UI marks demo records with a **DEMO DATA** badge. Simulated purchases and distributions never carry a transaction signature, and the database rejects simulated rows that have one. The dashboard never shows rewards for a connected wallet unless a distribution record exists for that address.

## Security

- **Server-side authorization everywhere.** `/admin/*` is checked in `proxy.ts`, again in the admin layout, again in each admin page through `adminRepository()`, and again in **every** server action through `guard()`. Hiding buttons is never the protection.
- **Admin identity.** With Supabase, admins use Supabase Auth plus `users.role = 'admin'`, and RLS policies call `is_admin()`. Without Supabase (demo mode), credentials come from server-only env vars. The session is an HMAC-SHA256 signed, `httpOnly`, `SameSite=Strict` cookie scoped to `/admin`, with an 8-hour expiry. Login attempts are throttled and passwords are compared in constant time.
- **No secrets in the browser.** The service-role key is only read in `server-only` modules. Only `NEXT_PUBLIC_*` values reach the client.
- **Row Level Security.** Applications (which hold contact details and wallets) are admin-only. Campaigns, screening reports, purchases, and distributions are publicly readable only for non-cancelled campaigns. All writes require an admin. Public status lookup goes through a `security definer` function that returns only the minimum fields.
- **Validation.** Zod checks on client and server. Solana addresses must decode to 32 bytes. Social links must point at the expected hosts. Database `CHECK` constraints back all of this up.
- Security headers are set in `next.config.ts`, including `X-Frame-Options: DENY`, `nosniff`, and `Referrer-Policy`.

## Recommended VS Code extensions

These are listed in `.vscode/extensions.json`, and VS Code will offer to install them when you open the repo: Tailwind CSS IntelliSense, ESLint, Prettier, Supabase, SQLTools, Pretty TypeScript Errors, Error Lens, GitLens.

## Roadmap (not in MVP)

- Live RUNNER balance lookups and snapshots from Solana RPC (Helius or Triton)
- Real USDC payment intake (Solana Pay or wallet-signed transfer) with on-chain confirmation
- Treasury swap execution and batched SPL distributions, with signatures recorded as `verified`
- Shared rate limiting (Redis or Upstash) and an admin audit log

## Disclaimer

Memecoins are highly speculative. Nothing here is financial, investment, legal, or tax advice. RUNNER screening is a risk review, not an endorsement or audit.
