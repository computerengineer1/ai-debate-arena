/**
 * GET/POST /api/profile — member profile (display name, bio, title).
 * Stored in KV; identity comes from the session (auth required).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { kv } from "@/lib/server/kv";
import { rateLimit, clientIp, sameOrigin } from "@/lib/server/guard";
import { quotaState } from "@/lib/server/quota";

export const runtime = "nodejs";

export interface Profile {
  displayName: string;
  bio: string;
  title: string;
  createdAt: string;
}

const TITLES = ["Analyst", "Orator", "Judge", "Philosopher", "Showman", "Logician"];

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!session?.user || !email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const stored = await kv.getJson<Profile>(`profile:${email}`);
  const quota = await quotaState({ id: email, guest: false });
  return NextResponse.json({
    profile: stored ?? {
      displayName: session.user.name ?? email.split("@")[0],
      bio: "",
      title: "Analyst",
      createdAt: new Date().toISOString(),
    },
    quota,
    picture: session.user.image ?? null,
    email,
  });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!session?.user || !email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const rl = await rateLimit(`profile:${email}`, 20, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Too many updates" }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const stored = (await kv.getJson<Profile>(`profile:${email}`)) ?? {
    displayName: session.user.name ?? email.split("@")[0],
    bio: "",
    title: "Analyst",
    createdAt: new Date().toISOString(),
  };

  const displayName = String(body.displayName ?? "").trim().slice(0, 40);
  const bio = String(body.bio ?? "").trim().slice(0, 280);
  const title = String(body.title ?? "");

  const next: Profile = {
    ...stored,
    displayName: displayName || stored.displayName,
    bio,
    title: TITLES.includes(title) ? title : stored.title,
  };
  // Basic injection hygiene — the values are only ever rendered as text
  next.displayName = next.displayName.replace(/[<>]/g, "");
  next.bio = next.bio.replace(/[<>]/g, "");

  await kv.setJson(`profile:${email}`, next);
  return NextResponse.json({ ok: true, profile: next, titles: TITLES });
}
