import { getAdminSession } from "@/lib/auth/admin";
import { getRepository } from "@/lib/data";
import { distributionsCsv } from "@/lib/exports/distributions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Route handlers do not inherit the protected layout's authorization checks.
  if (!(await getAdminSession())) {
    return new Response("Unauthorized", { status: 401, headers: HEADERS });
  }
  const { id } = await params;
  if (!/^[A-Za-z0-9-]{1,80}$/.test(id)) {
    return new Response("Invalid campaign id", { status: 400, headers: HEADERS });
  }
  const repo = getRepository();
  const detail = repo.getCampaignById(id);
  if (!detail) return new Response("Campaign not found", { status: 404, headers: HEADERS });

  return new Response(distributionsCsv(detail.campaign, repo.listDistributions(id)), {
    headers: {
      ...HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="runner-distributions-${id}.csv"`,
    },
  });
}
