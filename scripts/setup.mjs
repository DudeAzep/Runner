#!/usr/bin/env node
/**
 * One-time setup: creates .env.local with a strong admin password and session
 * secret. Safe to re-run — it never overwrites an existing .env.local.
 *
 *   npm run setup
 */
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const envPath = join(root, ".env.local");
const examplePath = join(root, ".env.example");

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\n✖ Node.js ${process.versions.node} is too old. Install Node.js 22.13+ (LTS) from https://nodejs.org and try again.\n`);
  process.exit(1);
}

if (existsSync(envPath)) {
  console.log("\n✓ .env.local already exists — leaving it unchanged.");
  console.log("  Your admin username/password are the ADMIN_USERNAME / ADMIN_PASSWORD lines in that file.\n");
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.error("✖ .env.example is missing. Run this from the project folder.");
  process.exit(1);
}

const password = randomBytes(12).toString("base64url");
const secret = randomBytes(48).toString("base64url");

copyFileSync(examplePath, envPath);
let env = readFileSync(envPath, "utf8");
env = env.replace(/^ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD=${password}`).replace(/^ADMIN_SESSION_SECRET=.*$/m, `ADMIN_SESSION_SECRET=${secret}`);
writeFileSync(envPath, env, { mode: 0o600 });

console.log(`
✓ Created .env.local

  Admin login (http://localhost:3000/admin)
    username: admin
    password: ${password}

  Save this password somewhere safe. You can change it any time in .env.local.

  Next:  npm run dev    → open http://localhost:3000
`);
