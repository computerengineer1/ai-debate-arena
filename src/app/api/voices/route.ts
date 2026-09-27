/**
 * GET /api/voices — introspection endpoint (debug/QA).
 * Lists the configured voice chain per language & character.
 */
import { NextResponse } from "next/server";
import { LANGUAGES } from "@/lib/languages";

export const runtime = "nodejs";

export async function GET() {
  const chain = (process.env.TTS_PROVIDER_CHAIN || "orpheus,elevenlabs,edge").split(",").map((s) => s.trim());
  return NextResponse.json({
    providerChain: chain,
    providers: {
      orpheus: {
        configured: Boolean(process.env.GROQ_API_KEY),
        languages: ["en", "ar"],
        note: "Requires one-time terms acceptance in Groq console (see .env.example)",
        models: { en: "canopylabs/orpheus-v1-english", ar: "canopylabs/orpheus-arabic-saudi" },
      },
      elevenlabs: {
        configured: Boolean(process.env.ELEVEN_API_KEY),
        model: process.env.ELEVEN_MODEL || "eleven_multilingual_v2",
        languages: "29+",
      },
      edge: { configured: true, languages: LANGUAGES.map((l) => l.code) },
    },
    languages: LANGUAGES.map((l) => ({
      code: l.code, name: l.name, nativeName: l.nativeName, flag: l.flag, rtl: !!l.rtl,
      voices: l.edgeVoices,
    })),
  });
}
