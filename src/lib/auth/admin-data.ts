import "server-only";
import { getRepositoryForRequest } from "@/lib/data";
import { requireAdminPage } from "./admin";

/**
 * Admin pages fetch data through this helper so authorization is re-checked
 * at the data-access layer, not only in the layout (layouts can be skipped on
 * client-side navigations).
 */
export async function adminRepository() {
  const repo = await getRepositoryForRequest();
  const session = await requireAdminPage();
  return { repo, session };
}
