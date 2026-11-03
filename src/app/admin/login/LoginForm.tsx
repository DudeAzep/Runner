"use client";

import { KeyRound, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Username
        </label>
        <input
          id="email"
          name="email"
          type="text"
          autoComplete="username"
          required
          className="field mt-1.5"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field mt-1.5" />
      </div>
      {state.error && (
        <p role="alert" className="rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-400">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        Sign in
      </Button>
    </form>
  );
}
