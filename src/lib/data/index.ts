import "server-only";
import { connection } from "next/server";
import { RunnerRepository } from "./runner-repository";

let repo: RunnerRepository | undefined;

/** The single data-access object. Backed by the local SQLite file (see store.ts). */
export function getRepository(): RunnerRepository {
  repo ??= new RunnerRepository();
  return repo;
}

/** For Server Components: opts the render into request time, then returns the repository. */
export async function getRepositoryForRequest(): Promise<RunnerRepository> {
  await connection();
  return getRepository();
}

export type { RunnerRepository } from "./runner-repository";
