"use client";

import { FlaskConical, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { simulateFeePayment } from "@/app/(site)/submit/actions";
import { Button } from "@/components/ui/Button";

/** TEST MODE stand-in for paying the fee after approval. No funds move. */
export function TestPayButton({ reference, amountLabel }: { reference: string; amountLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        variant="secondary"
        className="border-amber-400/40"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await simulateFeePayment(reference);
          setBusy(false);
          if (r.ok) router.refresh();
          else setError(r.message);
        }}
      >
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <FlaskConical className="size-4 text-amber-400" />}
        Simulate {amountLabel} USDC payment
      </Button>
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
