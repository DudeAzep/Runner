// Runs against a fresh temporary database with simulated payments/treasury only.
// Build first: npm run build && npm run test:smoke
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import { ADMIN_COOKIE, signAdminToken } from "../src/lib/auth/session-token.ts";

if (!existsSync(".next/BUILD_ID")) throw new Error("Run npm run build before npm run test:smoke.");

const temp = mkdtempSync(join(tmpdir(), "runner-smoke-"));
const dbPath = join(temp, "runner.db");
const secret = randomBytes(48).toString("base64url");
const listener = createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const base = `http://127.0.0.1:${port}`;
let output = "";
const server = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    RUNNER_DB_PATH: dbPath, SEED_DEMO_DATA: "true", SOLANA_CLUSTER: "devnet",
    PAYMENTS_MODE: "test", TREASURY_MODE: "test", TREASURY_WALLET: "", RUNNER_MINT: "",
    ADMIN_USERNAME: "smoke-admin", ADMIN_PASSWORD: randomBytes(24).toString("hex"), ADMIN_SESSION_SECRET: secret,
  },
});
server.stdout.on("data", (chunk) => { output = (output + chunk).slice(-8000); });
server.stderr.on("data", (chunk) => { output = (output + chunk).slice(-8000); });
let launchError;
server.on("error", (error) => { launchError = error; });

async function request(path, token) {
  return fetch(`${base}${path}`, {
    redirect: "manual", signal: AbortSignal.timeout(15_000),
    headers: token ? { Cookie: `${ADMIN_COOKIE}=${token}` } : {},
  });
}

try {
  const deadline = Date.now() + 60_000;
  let readiness = "No response";
  while (true) {
    if (launchError) throw launchError;
    if (server.exitCode !== null) throw new Error(`Server exited: ${server.exitCode}`);
    try {
      const response = await request("/admin/login");
      if (response.status === 200) break;
      readiness = `HTTP ${response.status}`;
    } catch (error) { readiness = error.message; }
    if (Date.now() > deadline) throw new Error(`Server did not become ready within 60 seconds: ${readiness}`);
    await delay(250);
  }

  for (const path of ["/", "/explore", "/how-it-works", "/dashboard", "/submit", "/status"]) {
    assert.equal((await request(path)).status, 200, path);
  }
  console.log("PASS public pages return 200");

  // Inspect only this run's isolated database. Never open the developer's database.
  const db = new DatabaseSync(dbPath, { readOnly: true });
  let campaigns;
  let rows;
  try {
    campaigns = db.prepare("SELECT data FROM campaigns").all().map((r) => JSON.parse(r.data));
    rows = db.prepare("SELECT data FROM distributions").all().map((r) => JSON.parse(r.data));
  } finally { db.close(); }
  const campaign = campaigns.find((c) => rows.some((r) => r.campaignId === c.id));
  assert.ok(campaign, "Demo data should include a campaign with distributions");
  const path = `/admin/campaigns/${campaign.id}/distributions.csv`;
  const token = await signAdminToken("smoke-admin", secret);
  const expired = await signAdminToken("smoke-admin", secret, Math.floor(Date.now() / 1000) - 86_400);
  for (const cookie of [undefined, "forged.invalid", expired]) {
    const response = await request(path, cookie);
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location"), base).pathname, "/admin/login");
    assert.equal(response.headers.get("content-disposition"), null);
  }
  console.log("PASS missing, forged, and expired sessions cannot download exports");

  for (const page of ["/admin", "/admin/applications", "/admin/campaigns", "/admin/settings", `/admin/campaigns/${campaign.id}`]) {
    const response = await request(page, token);
    assert.equal(response.status, 200, page);
    if (page.endsWith(campaign.id)) assert.ok((await response.text()).includes(`href="${path}"`));
  }
  assert.equal((await request(`/campaigns/${campaign.slug}`)).status, 200);
  console.log("PASS authenticated admin pages and the campaign export link");

  const response = await request(path, token);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/csv; charset=utf-8$/);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-disposition"), `attachment; filename="runner-distributions-${campaign.id}.csv"`);
  const csv = await response.text();
  const expected = rows.filter((r) => r.campaignId === campaign.id);
  assert.equal(csv.trimEnd().split("\r\n").length, expected.length + 1);
  for (const row of expected) {
    assert.ok(csv.includes(`"${row.id}"`));
    assert.ok(csv.includes(`"${row.rewardAmountRaw}"`));
    assert.ok(csv.includes(`"${row.distributionStatus}"`));
  }
  assert.equal((await request("/admin/campaigns/does-not-exist/distributions.csv", token)).status, 404);
  assert.equal((await request(`/admin/campaigns/${"a".repeat(81)}/distributions.csv`, token)).status, 400);
  const empty = campaigns.find((c) => !rows.some((r) => r.campaignId === c.id));
  assert.ok(empty, "Demo data should include an empty plan");
  const emptyResponse = await request(`/admin/campaigns/${empty.id}/distributions.csv`, token);
  assert.equal(emptyResponse.status, 200);
  assert.equal((await emptyResponse.text()).trimEnd().split("\r\n").length, 1);
  console.log(`PASS CSV contents (${expected.length} recipients), download headers, empty plans, and invalid/missing campaigns`);
  console.log("Smoke checks passed. Wallet signing and on-chain transfers were not tested.");
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (server.exitCode === null && !launchError) {
    const closed = once(server, "close");
    server.kill();
    await closed;
  }
  // Only the unique directory created above is removed.
  rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
