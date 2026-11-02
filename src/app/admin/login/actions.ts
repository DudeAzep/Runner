"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, ADMIN_SESSION_TTL_SECONDS, getSessionSecret, safeEqual, signAdminToken } from "@/lib/auth/session-token";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseSessionClient } from "@/lib/supabase/server";

export interface LoginState {
  error?: string;
}

// Simple per-process brute-force throttle (use a shared store such as Redis in production).
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 8;

async function clientKey(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

function tooMany(key: string): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.first > WINDOW_MS) return false;
  return a.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.first > WINDOW_MS) attempts.set(key, { count: 1, first: now });
  else a.count++;
}

export async function loginAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const key = await clientKey();
  if (tooMany(key)) return { error: "Too many attempts. Try again in 15 minutes." };

  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your credentials." };

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseSessionClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      recordFailure(key);
      return { error: "Invalid credentials." };
    }
    const { data: row } = await supabase.from("users").select("role").eq("auth_user_id", data.user.id).maybeSingle();
    if (row?.role !== "admin") {
      await supabase.auth.signOut();
      recordFailure(key);
      return { error: "This account is not authorized for admin access." };
    }
    redirect("/admin");
  }

  // Demo mode: credentials come from server-only environment variables.
  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD;
  const secret = getSessionSecret();
  if (!expectedPass || expectedPass.length < 12 || !secret) {
    return { error: "Admin access is not configured. Set ADMIN_PASSWORD (12+ chars) and ADMIN_SESSION_SECRET (32+ chars) on the server." };
  }
  const ok = (await safeEqual(email, expectedUser)) && (await safeEqual(password, expectedPass));
  if (!ok) {
    recordFailure(key);
    return { error: "Invalid credentials." };
  }
  attempts.delete(key);
  const token = await signAdminToken(expectedUser, secret);
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  redirect("/admin");
}

export async function logoutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseSessionClient();
    await supabase.auth.signOut();
  }
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin/login");
}
