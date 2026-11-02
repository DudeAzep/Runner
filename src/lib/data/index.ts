import "server-only";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DemoRepository } from "./demo-repository";
import type { RunnerRepository } from "./repository";
import { SupabaseRepository } from "./supabase-repository";

let demo: DemoRepository | undefined;

/**
 * Returns the active repository. Uses Supabase when NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are set;
 * otherwise falls back to the in-memory DEMO DATA store.
 */
export function getRepository(): RunnerRepository {
  if (isSupabaseConfigured()) return new SupabaseRepository();
  demo ??= new DemoRepository();
  return demo;
}

/** For Server Components: opts the render into request time, then returns the repository. */
export async function getRepositoryForRequest(): Promise<RunnerRepository> {
  await connection();
  return getRepository();
}

export type { RunnerRepository } from "./repository";
