/**
 * POST /api/tts — server-side voice synthesis proxy.
 * Walks the provider chain (orpheus → elevenlabs → edge) and returns
 * base64 audio + metadata. Client converts to a Blob URL and plays it
 * through the Web Audio graph (analyser → lip-sync + music ducking).
 */
import { NextRequest, NextResponse } from "next/server";
import { synthesize } from "@/lib/server/tts";
import { SUPPORTED_LANGUAGE_CODES } from "@/lib/languages";
import type { Emotion, Speaker } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_EMOTIONS = new Set(["calm", "thinking", "confident", "amused", "firm", "passionate", "angry", "sarcastic", "frustrated", "victorious"]);
const VALID_SPEAKERS = new Set<Speaker>(["logos", "pathos", "referee"]);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = String(body.text ?? "").trim().slice(0, 2000);
  const speaker = String(body.speaker ?? "") as Speaker;
  const language = String(body.language ?? "en");

  if (text.length < 2) return NextResponse.json({ error: "Text too short" }, { status: 400 });
  if (!VALID_SPEAKERS.has(speaker)) return NextResponse.json({ error: "Bad speaker" }, { status: 400 });
  if (!SUPPORTED_LANGUAGE_CODES.includes(language)) return NextResponse.json({ error: "Bad language" }, { status: 400 });

  const emotion = VALID_EMOTIONS.has(String(body.emotion)) ? (String(body.emotion) as Emotion) : "calm";
  const intensity = Math.min(1, Math.max(0.1, Number(body.intensity) || 0.5));

  try {
    const result = await synthesize({ text, speaker, language, emotion, intensity });
    return NextResponse.json({
      audio: result.audio.toString("base64"),
      mime: result.mime,
      provider: result.provider,
      voice: result.voice,
      cached: result.cached,
    });
  } catch (e) {
    console.error("[api/tts]", e);
    // 503 tells the client to fall back to the browser speech engine.
    return NextResponse.json({ error: "TTS_FAILED", detail: String(e).slice(0, 300) }, { status: 503 });
  }
}
