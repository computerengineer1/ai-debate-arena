/**
 * POST /api/billing/webhook — Lemon Squeezy webhooks.
 *
 * Professional payment confirmation, three layers:
 *  1. HMAC-SHA256 signature check (x-signature header vs LS_WEBHOOK_SECRET)
 *     with timing-safe comparison — forged events are rejected.
 *  2. Idempotency: every event id is stored for 7 days; replays are no-ops.
 *  3. Entitlements are granted from the SIGNED payload only (variant id →
 *     plan), with an expiry taken from `renews_at`.
 *
 * Configure in LS dashboard: Webhooks → point to
 *   https://YOUR-DOMAIN/api/billing/webhook
 * events: subscription_created, subscription_updated, subscription_expired,
 *         subscription_cancelled, order_created
 */
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { kv } from "@/lib/server/kv";
import type { PlanId } from "@/lib/server/quota";

export const runtime = "nodejs";

interface LsEvent {
  meta: { event_name: string; event_id?: string };
  data: {
    type?: string;
    id?: string;
    attributes: {
      user_email?: string;
      first_order_item?: { variant_id?: number; product_id?: number };
      variant_id?: number;
      product_id?: number;
      status?: string;
      renews_at?: string | null;
      ends_at?: string | null;
      customer?: { email?: string };
    };
  };
}

function variantToPlan(variantId?: number, productId?: number): PlanId | null {
  const v = String(variantId ?? "");
  const p = String(productId ?? "");
  if (v && v === process.env.LS_VARIANT_ORATOR) return "orator";
  if (v && v === process.env.LS_VARIANT_LEGEND) return "legend";
  if (p && p === process.env.LS_PRODUCT_ORATOR) return "orator";
  if (p && p === process.env.LS_PRODUCT_LEGEND) return "legend";
  return null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.LS_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const raw = await req.text();
  const sig = req.headers.get("x-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 401 });

  const digest = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(digest, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let event: LsEvent;
  try {
    event = JSON.parse(raw) as LsEvent;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  // Idempotency — LS retries; we never double-grant
  const eventId = event.meta?.event_id ?? `${event.meta?.event_name}:${event.data?.id}`;
  if (eventId) {
    const seen = await kv.get(`evt:${eventId}`);
    if (seen) return NextResponse.json({ ok: true, duplicate: true });
    await kv.set(`evt:${eventId}`, "1", 7 * 86400);
  }

  const attrs = event.data?.attributes ?? {};
  const email = (attrs.user_email ?? attrs.customer?.email ?? "").toLowerCase().trim();
  const name = event.meta?.event_name ?? "";

  if (!email) return NextResponse.json({ ok: true, ignored: "no email" });

  if (name === "subscription_created" || name === "subscription_updated" || name === "order_created") {
    const active = !attrs.status || ["active", "on_trial", "paid"].includes(attrs.status);
    const plan = variantToPlan(attrs.first_order_item?.variant_id ?? attrs.variant_id, attrs.first_order_item?.product_id ?? attrs.product_id);
    if (!plan || !active) return NextResponse.json({ ok: true, ignored: "not a tracked plan" });
    const until = attrs.renews_at ?? new Date(Date.now() + 31 * 86400).toISOString();
    await kv.setJson(`sub:${email}`, { plan, until, since: new Date().toISOString() }, 400 * 86400);
    console.log(`[billing] granted ${plan} to ${email} until ${until}`);
    return NextResponse.json({ ok: true, granted: plan });
  }

  if (name === "subscription_expired" || name === "subscription_cancelled") {
    // cancelled = keeps access until period end; expired = downgrade now
    if (name === "subscription_expired") {
      await kv.set(`sub:${email}`, JSON.stringify({ plan: "free", until: new Date().toISOString() }), 86400);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: name });
}
