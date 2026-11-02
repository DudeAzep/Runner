"use client";

import { CircleCheck, CircleX, LoaderCircle, TriangleAlert } from "lucide-react";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/app/admin/actions";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

export interface ConfirmConfig {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger" | "volt";
}

/**
 * Server-action form with optional confirmation dialog. The dialog is a UX
 * safeguard only — authorization happens on the server in every action.
 */
export function AdminForm({
  action,
  children,
  submitLabel,
  submitVariant = "primary",
  confirm,
  className,
  hidden,
  inline = false,
  disabled = false,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel: string;
  submitVariant?: "primary" | "secondary" | "danger" | "volt";
  confirm?: ConfirmConfig;
  className?: string;
  hidden?: Record<string, string>;
  inline?: boolean;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const visibleResult = state && state.at !== dismissedAt ? state : null;

  useEffect(() => {
    if (!state?.ok) return;
    const t = setTimeout(() => setDismissedAt(state.at), 6000);
    return () => clearTimeout(t);
  }, [state]);

  const onSubmitClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!confirm) return;
    e.preventDefault();
    if (formRef.current && !formRef.current.reportValidity()) return;
    dialogRef.current?.showModal();
  };

  return (
    <form ref={formRef} action={formAction} className={cn(inline ? "inline-flex flex-col" : "space-y-4", className)}>
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <div className={cn("flex flex-wrap items-center gap-3", inline && "gap-2")}>
        <Button type="submit" variant={submitVariant} size="sm" disabled={pending || disabled} onClick={onSubmitClick}>
          {pending && <LoaderCircle className="size-3.5 animate-spin" />}
          {submitLabel}
        </Button>
        {visibleResult && !inline && <ResultMessage result={visibleResult} />}
      </div>
      {visibleResult && inline && <ResultMessage result={visibleResult} />}

      {confirm && (
        <dialog
          ref={dialogRef}
          className="m-auto w-[min(92vw,440px)] rounded-lg border border-ink-600 bg-ink-850 p-0 text-fg shadow-2xl shadow-black/70 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
          onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
        >
          <div className="p-6">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-md border",
                  confirm.tone === "danger" ? "border-rose-400/30 bg-rose-400/10 text-rose-400" : "border-violet-500/30 bg-violet-500/10 text-violet-300",
                )}
              >
                <TriangleAlert className="size-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold">{confirm.title}</h2>
                <div className="mt-2 text-sm leading-relaxed text-fg-muted">{confirm.body}</div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => dialogRef.current?.close()} autoFocus>
                Cancel
              </Button>
              <Button
                type="button"
                variant={confirm.tone === "danger" ? "danger" : confirm.tone === "volt" ? "volt" : "primary"}
                size="sm"
                onClick={() => {
                  dialogRef.current?.close();
                  formRef.current?.requestSubmit();
                }}
              >
                {confirm.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </form>
  );
}

function ResultMessage({ result }: { result: ActionResult }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-1.5 text-xs", result.ok ? "text-volt-400" : "text-rose-400")}>
      {result.ok ? <CircleCheck className="size-3.5" /> : <CircleX className="size-3.5" />}
      {result.message}
    </span>
  );
}
