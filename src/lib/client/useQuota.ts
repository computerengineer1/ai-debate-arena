/**
 * useQuota — client bridge to the quota system.
 * Guests are fingerprinted by a local UUID (the hook); members by session.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

export interface QuotaView {
  plan: "free" | "orator" | "legend";
  used: number;
  limit: number;
  left: number;
  resetsInDays: number;
  needSignIn?: boolean;
  needPlan?: boolean;
}

export function guestToken(): string {
  if (typeof window === "undefined") return "";
  try {
    let t = localStorage.getItem("arena-guest");
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem("arena-guest", t);
    }
    return t;
  } catch {
    return "";
  }
}

export function useQuota() {
  const [quota, setQuota] = useState<QuotaView | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/quota", { headers: { "x-guest-token": guestToken() } });
      setQuota((await r.json()) as QuotaView);
    } catch {
      /* offline → stay silent */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const consume = useCallback(async (): Promise<{ status: number; body: Record<string, unknown> }> => {
    const r = await fetch("/api/quota", { method: "POST", headers: { "x-guest-token": guestToken() } });
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: r.status, body };
  }, []);

  return { quota, refresh, consume };
}
