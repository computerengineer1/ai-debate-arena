/**
 * /ads.txt — required by Google AdSense. Serves your publisher id:
 * set NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX in Vercel env.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || process.env.ADSENSE_CLIENT || "";
  const body = client ? `google.com, ${client}, DIRECT, f08c47fec0942fa0\n` : "placeholder\n";
  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
