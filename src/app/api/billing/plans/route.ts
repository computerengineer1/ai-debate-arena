/**
 * GET /api/billing/plans — public plan catalog + checkout links.
 * Checkout happens ON Lemon Squeezy (PCI-DSS SAQ-A: our servers never
 * see a card number). Money is paid out by LS to YOUR bank/PayPal.
 */
import { NextResponse } from "next/server";
import { PLANS } from "@/lib/server/quota";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    currency: "USD",
    processor: "lemonsqueezy",
    plans: PLANS.map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      priceMonthly: p.priceMonthly,
      debatesPerWeek: p.debatesPerWeek,
      ads: p.ads,
      perks: p.perks,
      checkoutUrl: p.checkoutEnv ? process.env[p.checkoutEnv] ?? "" : "",
    })),
  });
}
