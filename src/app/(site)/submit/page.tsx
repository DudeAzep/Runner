import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Container, PageHeader } from "@/components/layout/PageHeader";
import { getPublicConfig } from "@/lib/config";
import { PACKAGE_IDS } from "@/lib/economics/allocation";
import { SubmitForm } from "./SubmitForm";

export const metadata: Metadata = { title: "Submit a Project" };

export default async function SubmitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection(); // read settings at request time, not build time
  const cfg = getPublicConfig();
  const requested = (await searchParams).package;
  const initialPackage = PACKAGE_IDS.find((id) => id === requested);
  return (
    <Container className="max-w-4xl">
      <PageHeader
        eyebrow="Project application"
        title="Submit your project"
        description="Apply for a RUNNER campaign. Approved projects receive a treasury token purchase distributed to eligible RUNNER holders."
      />

      <div className="mb-8 flex items-start gap-3 rounded-lg border border-violet-500/40 bg-violet-500/[0.07] p-5" role="note">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-violet-300" aria-hidden />
        <div>
          <p className="text-[15px] font-medium leading-relaxed text-fg">
            Submitting an application does not guarantee approval. All projects undergo independent screening. Campaign fees do not purchase
            a guaranteed endorsement or approval.
          </p>
          <p className="mt-2 text-sm text-fg-muted">
            Already applied?{" "}
            <Link href="/status" className="text-violet-300 underline-offset-4 hover:underline">
              Check your application status
            </Link>
            .
          </p>
        </div>
      </div>

      <SubmitForm paymentsLive={cfg.paymentsLive} cluster={cfg.cluster} initialPackage={initialPackage} />
    </Container>
  );
}
