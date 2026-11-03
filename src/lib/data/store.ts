import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  Application,
  Campaign,
  Distribution,
  Screening,
  Snapshot,
  SnapshotHolders,
  TokenReport,
  TreasuryPurchase,
} from "@/lib/types";
import { createDemoSeed } from "./demo-seed";

/**
 * Zero-setup persistence: a single SQLite file (default ./data/runner.db)
 * using Node's built-in `node:sqlite` — no database server, no account, no
 * native build step.
 *
 * Each collection is a table of JSON documents keyed by id. All records are
 * loaded into memory on first use and every mutation is written through to
 * disk immediately, so reads are fast and nothing is lost on restart.
 *
 * Designed for a single server instance (one `npm start` process).
 */

export interface StoreData {
  applications: Application[];
  screenings: Screening[];
  campaigns: Campaign[];
  purchases: TreasuryPurchase[];
  distributions: Distribution[];
  snapshots: Snapshot[];
  snapshotHolders: SnapshotHolders[];
  tokenReports: TokenReport[];
  /** Transaction signatures already consumed (payments, purchases, distributions). */
  usedSignatures: { id: string; usedFor: string; at: string }[];
}

export type CollectionName = keyof StoreData;
const COLLECTIONS: CollectionName[] = [
  "applications",
  "screenings",
  "campaigns",
  "purchases",
  "distributions",
  "snapshots",
  "snapshotHolders",
  "tokenReports",
  "usedSignatures",
];

interface StoreHandle {
  data: StoreData;
  db: DatabaseSync;
}

const g = globalThis as unknown as { __runnerStore?: StoreHandle };

function dbPath(): string {
  const p = process.env.RUNNER_DB_PATH?.trim();
  if (p === ":memory:") return p;
  return resolve(process.cwd(), p || "data/runner.db");
}

function open(): StoreHandle {
  const path = dbPath();
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;");
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  for (const name of COLLECTIONS) {
    db.exec(`CREATE TABLE IF NOT EXISTS "${name}" (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)`);
  }

  const data = {} as StoreData;
  for (const name of COLLECTIONS) {
    const rows = db.prepare(`SELECT data FROM "${name}" ORDER BY rowid`).all() as { data: string }[];
    (data as unknown as Record<string, unknown[]>)[name] = rows.map((r) => JSON.parse(r.data));
  }

  const seeded = db.prepare("SELECT value FROM meta WHERE key = 'seeded'").get() as { value: string } | undefined;
  if (!seeded) {
    if (process.env.SEED_DEMO_DATA !== "false") {
      const seed = createDemoSeed();
      const handle = { data, db };
      transaction(handle, () => {
        for (const name of Object.keys(seed) as (keyof typeof seed)[]) {
          for (const item of seed[name]) upsertRaw(handle, name, item as never);
        }
      });
    }
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded', ?)").run(new Date().toISOString());
  }
  return { data, db };
}

function upsertRaw<K extends CollectionName>(h: StoreHandle, name: K, item: StoreData[K][number]) {
  const list = h.data[name] as { id: string }[];
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  h.db
    .prepare(`INSERT INTO "${name}" (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
    .run(item.id, JSON.stringify(item), new Date().toISOString());
}

function transaction(h: StoreHandle, fn: () => void) {
  h.db.exec("BEGIN");
  try {
    fn();
    h.db.exec("COMMIT");
  } catch (e) {
    h.db.exec("ROLLBACK");
    // Reload memory from disk so it matches the rolled-back state.
    for (const name of COLLECTIONS) {
      const rows = h.db.prepare(`SELECT data FROM "${name}" ORDER BY rowid`).all() as { data: string }[];
      (h.data as unknown as Record<string, unknown[]>)[name] = rows.map((r) => JSON.parse(r.data));
    }
    throw e;
  }
}

function handle(): StoreHandle {
  g.__runnerStore ??= open();
  return g.__runnerStore;
}

/** Read access to all collections (do not mutate the returned arrays). */
export function store(): StoreData {
  return handle().data;
}

/** Insert or replace a record and persist it. */
export function save<K extends CollectionName>(name: K, item: StoreData[K][number]): void {
  upsertRaw(handle(), name, item);
}

/** Delete a record by id. */
export function remove(name: CollectionName, id: string): void {
  const h = handle();
  const list = h.data[name] as { id: string }[];
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0) list.splice(idx, 1);
  h.db.prepare(`DELETE FROM "${name}" WHERE id = ?`).run(id);
}

/** Run several writes atomically. */
export function atomic(fn: () => void): void {
  transaction(handle(), fn);
}
