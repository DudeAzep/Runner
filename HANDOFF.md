# Handoff notes (for continuing in Claude Code)

Status as of the last session. Read `AGENTS.md` too: this is Next.js 16, so check `node_modules/next/dist/docs/` before relying on older APIs.

## Done and verified
- Full public site and admin, Tailwind v4 design system, Next 16 App Router with `cacheComponents: false`.
- Storage moved from Supabase to **SQLite via `node:sqlite`** (`src/lib/data/store.ts`): JSON-document tables, write-through cache, demo seed on first run. Supabase was removed entirely.
- Real Solana features, all built server-side in `src/lib/solana/server.ts`. The browser only signs.
  - Token screening report (RPC mint info, largest accounts, DexScreener)
  - Live USDC payments with memo `RUNNER:<ref>`, verified on-chain, with signature replay protection
  - Jupiter treasury swaps (`lite-api.jup.ag/swap/v1`), plus verifying an external swap by its signature
  - Holder snapshots (getProgramAccounts on both token programs, or CSV import, with exclusions)
  - Distribution plan, then batched `transferChecked` with ATA creation. Rows are marked `submitted` before broadcast, then settled per recipient. `reconcileDistributionsAction` handles interrupted sends.
  - Live RUNNER balance on the dashboard
- Admin Settings page (config status, RPC check, remove demo data). `npm run setup` generates `.env.local`.
- Tests: `npm test` passes 38 tests (allocation, rewards, verify, repository lifecycle). `tsc`, `eslint`, and `next build` all pass. Smoke test: every page returns 200 and `data/runner.db` is created.

## NOT yet verified (this sandbox couldn't reach Solana, Jupiter, or DexScreener)
1. A real devnet end-to-end run:
   - Set `SOLANA_CLUSTER=devnet`, a treasury address, and `PAYMENTS_MODE=live`.
   - Get devnet USDC (mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`).
   - Submit an application, pay, then fetch a token report, take a snapshot via CSV, run a simulated purchase, and do live distribution batches. Jupiter is mainnet-only. On devnet, test the verify-by-signature path or temporarily allow simulated purchases.
2. Confirm Phantom/Solflare `signTransaction` on v0 transactions works for both server-built txs and Jupiter's tx.
3. Confirm that `lite-api.jup.ag/swap/v1` is still the current free Jupiter endpoint. It's configurable via `JUPITER_API_URL`.
4. Re-run and update the old Playwright E2E. The admin campaign page changed: the purchase, snapshot, and distribution panels replaced the old single-wallet distribution form and the eligible-supply field.

## Suggested next steps
- `Dockerfile` exists but hasn't been built or tested yet.
- Devnet testing mode for purchases: allow simulated purchases when `cluster=devnet` even if `TREASURY_MODE=live`.
- Admin audit log (who did what, when) and CSV export of distributions.
- Optional: Helius DAS holder count in token reports when the RPC is Helius.
- Before mainnet: a security review of `src/app/admin/actions.ts` and `src/lib/solana/*`, plus legal review.
