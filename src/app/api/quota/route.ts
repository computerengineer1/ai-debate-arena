/**
 * GET  /api/quota/status  → { plan, used, limit, left, resetsInDays }
 * POST /api/quota/consume → atomically spend one debate.
 *   200 ok · 401 guest must sign in · 402 member must upgrade · 429 rate-limited
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveIdentity } from "@/auth";
import { consumeDebate, quotaState, QuotaError, PLANS } from "@/lib/server/quota";
import { rateLimit, clientIp, sameOrigin } from "@/lib/server/guard";

export const runtime = "nodejs";

function guestHeader(req: NextRequest) {
  return req.headers.get("x-guest-token") ?? undefined;
}

export async function GET(req: NextRequest) {
  const ident = await resolveIdentity(req);
  if (!ident) {
    return NextResponse.json({ plan: "free", used: 0, limit: 1, left: 1, resetsInDays: 7, anonymous: true });
  }
  const state = await quotaState(ident);
  return NextResponse.json(state);
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });

  const ident = await resolveIdentity(req);
  const ip = clientIp(req);
  const rl = await rateLimit(`consume:${ident?.id ?? ip}`, ident?.guest ? 3 : 12, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests — slow down" }, { status: 429 });

  if (!ident) {
    return NextResponse.json({ error: "Missing guest token", needSignIn: true }, { status: 401 });
  }

  try {
    const state = await consumeDebate(ident);
    return NextResponse.json({ ok: true, ...state });
  } catch (e) {
    if (e instanceof QuotaError) {
      return NextResponse.json(
        {
          error: e.message,
          needSignIn: e.status === 401,
          needPlan: e.status === 402,
          plans: PLANS.map((p) => ({ id: p.id, name: p.name, priceMonthly: p.priceMonthly, perks: p.perks, tagline: p.tagline })),
        },
        { status: e.status },
      );
    }
    console.error("[quota/consume]", e);
    return NextResponse.json({ error: "Quota service error" }, { status: 500 });
  }
}
