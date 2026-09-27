/**
 * ─────────────────────────────────────────────────────────────────────
 *  Quota & plans — the business rules:
 *    • Guests      : 1 free debate (the hook), then sign-in wall
 *    • Free member : 5 debates / ISO week (auto-reset every Monday)
 *    • Orator (Pro): unlimited + no ads + MP3 export
 *    • Legend      : unlimited + everything
 *  Counters live in KV keyed by identity + ISO week → weekly reset is
 *  automatic (keys expire, week key rolls over).
 * ─────────────────────────────────────────────────────────────────────
 */
import { kv } from "./kv";

export type PlanId = "free" | "orator" | "legend";

export interface PlanDef {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthly: number;
  debatesPerWeek: number; // -1 = unlimited
  ads: boolean;
  perks: string[];
  /** Lemon Squeezy checkout URL (env-configured) */
  checkoutEnv: string;
}

export const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Sophist",
    tagline: "Taste the arena",
    priceMonthly: 0,
    debatesPerWeek: 5,
    ads: true,
    perks: ["5 debates / week", "16 languages", "Full cinematic show", "Weekly topic votes"],
    checkoutEnv: "",
  },
  {
    id: "orator",
    name: "Orator",
    tagline: "For the addicted",
    priceMonthly: 4.99,
    debatesPerWeek: -1,
    ads: false,
    perks: ["Unlimited debates", "Ad-free cinema", "MP3 download of any debate", "Priority voice engine", "Profile badge 🎙️"],
    checkoutEnv: "LS_CHECKOUT_ORATOR",
  },
  {
    id: "legend",
    name: "Legend",
    tagline: "Own the arena",
    priceMonthly: 11.99,
    debatesPerWeek: -1,
    ads: false,
    perks: ["Everything in Orator", "Custom personas & stances", "Commercial license for clips", "Early access features", "Hall-of-Fame slot 🏆"],
    checkoutEnv: "LS_CHECKOUT_LEGEND",
  },
];

export const GUEST_LIMIT = 1;

/** ISO week key, e.g. "2026-W39" — rolls over every Monday 00:00 UTC. */
export function weekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Days until the weekly reset (Monday 00:00 UTC). */
export function daysUntilReset(): number {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + (8 - day)));
  return Math.max(1, Math.ceil((monday.getTime() - now.getTime()) / 86400000));
}

export interface Identity {
  /** email for members, "guest:<token>" for guests */
  id: string;
  guest: boolean;
}

export interface QuotaState {
  plan: PlanId;
  used: number;
  limit: number; // -1 unlimited
  left: number; // -1 unlimited
  resetsInDays: number;
  subscriptionUntil: string | null;
}

export async function getPlan(id: string, guest: boolean): Promise<PlanId> {
  if (guest) return "free";
  const sub = await kv.getJson<{ plan: PlanId; until: string }>(`sub:${id}`);
  if (sub && sub.until && new Date(sub.until).getTime() > Date.now()) return sub.plan;
  return "free";
}

export async function quotaState(ident: Identity): Promise<QuotaState> {
  const plan = await getPlan(ident.id, ident.guest);
  const def = PLANS.find((p) => p.id === plan)!;
  const limit = ident.guest ? GUEST_LIMIT : def.debatesPerWeek;
  const used = Number((await kv.get(`quota:${ident.id}:${weekKey()}`)) ?? 0);
  const left = limit < 0 ? -1 : Math.max(0, limit - used);
  return { plan, used, limit, left, resetsInDays: daysUntilReset(), subscriptionUntil: null };
}

/**
 * Atomically consume one debate. Returns the new state, or throws
 * QuotaError(402) when the limit is reached (client opens pricing).
 */
export class QuotaError extends Error {
  constructor(public status: 401 | 402, msg: string) {
    super(msg);
  }
}

export async function consumeDebate(ident: Identity): Promise<QuotaState> {
  const state = await quotaState(ident);
  if (state.limit >= 0 && state.left <= 0) {
    throw new QuotaError(ident.guest ? 401 : 402, "Weekly limit reached");
  }
  const wk = weekKey();
  await kv.incr(`quota:${ident.id}:${wk}`, 8 * 86400); // expire after 8 days
  return { ...state, used: state.used + 1, left: state.limit < 0 ? -1 : state.left - 1 };
}
