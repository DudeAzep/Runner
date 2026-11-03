"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { CircleCheck, CircleX, LoaderCircle, Send, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { prepareDistributionBatchAction, submitDistributionBatchAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { signWithWallet, walletErrorMessage } from "@/lib/solana/client";
import { TreasuryWalletGate } from "./TreasuryWalletGate";

/**
 * Sends planned rewards in batches. Each batch is one transaction the
 * treasury wallet approves; the server records it before broadcasting,
 * then verifies every recipient's balance change on-chain.
 */
export function DistributionSender({ campaignId, treasury, pending, batchSize }: { campaignId: string; treasury: string; pending: number; batchSize: number }) {
  const { signTransaction } = useWallet();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<{ ok: boolean; message: string }[]>([]);
  const stop = useRef(false);

  const push = (ok: boolean, message: string) => setLog((l) => [{ ok, message }, ...l].slice(0, 8));

  const run = async (all: boolean) => {
    if (!window.confirm(all ? `Send rewards to all ${pending} pending recipients? You'll approve one transaction per batch of up to ${batchSize}.` : "Send the next batch of rewards? This is a real transaction.")) return;
    stop.current = false;
    setRunning(true);
    try {
      do {
        const prep = await prepareDistributionBatchAction(campaignId);
        if (!prep.ok || !prep.data) {
          push(prep.message === "No pending recipients.", prep.message);
          break;
        }
        const signed = await signWithWallet(signTransaction, prep.data.transaction);
        const res = await submitDistributionBatchAction(campaignId, prep.data.ids, signed, prep.data.blockhash, prep.data.lastValidBlockHeight);
        push(res.ok, res.message);
        router.refresh();
        if (!res.ok) break;
      } while (all && !stop.current);
    } catch (e) {
      push(false, walletErrorMessage(e));
    }
    setRunning(false);
    router.refresh();
  };

  return (
    <TreasuryWalletGate treasury={treasury}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run(false)} disabled={running || pending === 0} size="sm">
            {running ? <LoaderCircle className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Send next batch
          </Button>
          <Button onClick={() => run(true)} disabled={running || pending === 0} size="sm" variant="volt">
            Send all ({pending})
          </Button>
          {running && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                stop.current = true;
              }}
            >
              <Square className="size-3.5" /> Stop after this batch
            </Button>
          )}
        </div>
        {log.length > 0 && (
          <ul className="space-y-1">
            {log.map((l, i) => (
              <li key={i} className={`flex items-start gap-1.5 text-xs ${l.ok ? "text-volt-400" : "text-rose-400"}`}>
                {l.ok ? <CircleCheck className="mt-px size-3.5 shrink-0" /> : <CircleX className="mt-px size-3.5 shrink-0" />}
                {l.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </TreasuryWalletGate>
  );
}
