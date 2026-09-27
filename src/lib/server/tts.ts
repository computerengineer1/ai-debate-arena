/**
 * ─────────────────────────────────────────────────────────────────────
 *  VOICE ENGINE — a resilient, multi-provider speech synthesis chain.
 *
 *  Priority (env TTS_PROVIDER_CHAIN, default "orpheus,elevenlabs,edge"):
 *   1. orpheus    — Groq-hosted Orpheus open neural TTS. Human-like with
 *                   in-text EMOTION TAGS ([anger], [amusement]…). EN + AR.
 *   2. elevenlabs — Highest realism, 29+ languages (needs ELEVEN_API_KEY).
 *   3. edge       — Microsoft Edge neural voices. FREE, no key, 16 langs,
 *                   native accents, per-emotion prosody (rate/pitch).
 *  (4. "browser"  — client-side Web Speech API fallback lives in the
 *                   frontend audio engine, used only if this route fails.)
 *
 *  Results are cached (LRU, keyed by text|voice|provider|prosody) so
 *  replays/restarts are instant and API usage is minimal.
 * ─────────────────────────────────────────────────────────────────────
 */
import { MsEdgeTTS, OUTPUT_FORMAT, ProsodyOptions } from "msedge-tts";
import type { Emotion, Speaker } from "../types";
import { getLanguage } from "../languages";
import { getCache, sha256 } from "./cache";

export interface TtsRequest {
  text: string;
  speaker: Speaker;
  language: string; // language code, e.g. "en"
  emotion?: Emotion;
  intensity?: number; // 0.1 - 1.0
}

export interface TtsResult {
  audio: Buffer;
  mime: string;
  provider: string;
  voice: string;
  cached: boolean;
}

const audioCache = getCache<{ b64: string; mime: string; provider: string; voice: string }>("tts");

/* ───────────────────────── emotion → prosody/voice-tag maps ───────────────────────── */

/** Orpheus in-text emotion tags (open-weight Orpheus tag vocabulary). */
const ORPHEUS_TAG: Record<Emotion, string> = {
  calm: "[neutral]",
  thinking: "[hesitation]",
  confident: "[neutral]",
  amused: "[amusement]",
  firm: "[neutral]",
  passionate: "[excitement]",
  angry: "[anger]",
  sarcastic: "[amusement]",
  frustrated: "[disgust]",
  victorious: "[excitement]",
};

/** ElevenLabs voice_settings per emotion (stability↓ = more expressive). */
function elevenSettings(emotion: Emotion, intensity: number) {
  const base: Record<Emotion, { stability: number; style: number }> = {
    calm: { stability: 0.62, style: 0.25 },
    thinking: { stability: 0.55, style: 0.3 },
    confident: { stability: 0.5, style: 0.45 },
    amused: { stability: 0.45, style: 0.6 },
    firm: { stability: 0.45, style: 0.5 },
    passionate: { stability: 0.35, style: 0.7 },
    angry: { stability: 0.25, style: 0.8 },
    sarcastic: { stability: 0.4, style: 0.65 },
    frustrated: { stability: 0.35, style: 0.6 },
    victorious: { stability: 0.35, style: 0.75 },
  };
  const b = base[emotion] ?? base.calm;
  // Higher intensity pushes further from neutral
  const k = Math.min(1, Math.max(0, intensity));
  return {
    stability: Math.max(0.1, b.stability - k * 0.15),
    similarity_boost: 0.8,
    style: Math.min(1, b.style + k * 0.2),
    use_speaker_boost: true,
  };
}

/** Edge prosody: map emotion+intensity to rate/pitch deltas. */
function edgeProsody(emotion: Emotion, intensity: number, speaker: Speaker, langCode: string): ProsodyOptions {
  const lang = getLanguage(langCode);
  const preset = lang.edgeOptions?.[speaker] ?? {};
  const rateMap: Record<Emotion, number> = {
    calm: -6, thinking: -4, confident: 0, amused: +4, firm: +2,
    passionate: +10, angry: +14, sarcastic: +2, frustrated: +8, victorious: +10,
  };
  const pitchMap: Record<Emotion, number> = {
    calm: -2, thinking: -1, confident: +1, amused: +3, firm: 0,
    passionate: +4, angry: +5, sarcastic: +3, frustrated: +2, victorious: +5,
  };
  const k = Math.min(1, Math.max(0.1, intensity));
  const rate = Math.round((rateMap[emotion] ?? 0) * k);
  const pitch = Math.round((pitchMap[emotion] ?? 0) * k);
  const opts: ProsodyOptions = {
    rate: `${rate >= 0 ? "+" : ""}${rate}%`,
    pitch: `${pitch >= 0 ? "+" : ""}${pitch}Hz`,
    volume: "100",
  };
  // Merge language/character preset rate if defined (e.g. referee speaks slower)
  if (preset.rate) opts.rate = preset.rate;
  if (preset.pitch) opts.pitch = preset.pitch;
  return opts;
}

/* ─────────────────────────────── providers ─────────────────────────────── */

function providerChain(): string[] {
  const raw = (process.env.TTS_PROVIDER_CHAIN || "orpheus,elevenlabs,edge")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (!raw.includes("edge")) raw.push("edge"); // always keep the free workhorse last
  return raw;
}

const ORPHEUS_MODEL: Record<string, string> = {
  en: "canopylabs/orpheus-v1-english",
  ar: "canopylabs/orpheus-arabic-saudi",
};

async function synthOrpheus(req: TtsRequest): Promise<TtsResult | null> {
  const model = ORPHEUS_MODEL[req.language];
  const key = process.env.GROQ_API_KEY;
  if (!model || !key) return null; // language/key not supported → skip
  const voice =
    (req.speaker === "logos" && process.env.ORPHEUS_VOICE_LOGOS) ||
    (req.speaker === "pathos" && process.env.ORPHEUS_VOICE_PATHOS) ||
    (req.speaker === "referee" && process.env.ORPHEUS_VOICE_REFEREE) ||
    "male-01";
  const tag = ORPHEUS_TAG[req.emotion ?? "calm"];
  const body = JSON.stringify({
    model,
    input: `${tag} ${req.text}`,
    voice,
    response_format: "mp3",
  });
  const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    // Terms-not-accepted or unknown voice → silently fall through to next provider
    console.warn(`[tts:orpheus] skipped (${res.status}): ${msg.slice(0, 160)}`);
    return null;
  }
  const audio = Buffer.from(await res.arrayBuffer());
  return { audio, mime: "audio/mpeg", provider: "orpheus", voice, cached: false };
}

const ELEVEN_DEFAULTS: Record<Speaker, string> = {
  // Sensible ElevenLabs premade voices; override via env for custom clones.
  logos: "pNInz6obpgDQGcFmaJgB", // Adam — deep, calm male
  pathos: "VR6AewLTigWG4xSOukaG", // Arnold — strong, expressive
  referee: "pqHfZKP75CvOlQylNhV4", // Bill — authoritative
};

async function synthElevenLabs(req: TtsRequest): Promise<TtsResult | null> {
  const key = process.env.ELEVEN_API_KEY;
  if (!key) return null;
  const voice =
    (req.speaker === "logos" && process.env.ELEVEN_VOICE_LOGOS) ||
    (req.speaker === "pathos" && process.env.ELEVEN_VOICE_PATHOS) ||
    (req.speaker === "referee" && process.env.ELEVEN_VOICE_REFEREE) ||
    ELEVEN_DEFAULTS[req.speaker];
  const model = process.env.ELEVEN_MODEL || "eleven_multilingual_v2";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: req.text,
      model_id: model,
      voice_settings: elevenSettings(req.emotion ?? "calm", req.intensity ?? 0.5),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    console.warn(`[tts:elevenlabs] skipped (${res.status})`);
    return null;
  }
  const audio = Buffer.from(await res.arrayBuffer());
  return { audio, mime: "audio/mpeg", provider: "elevenlabs", voice, cached: false };
}

async function synthEdge(req: TtsRequest): Promise<TtsResult | null> {
  const lang = getLanguage(req.language);
  const voice = lang.edgeVoices[req.speaker];
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(
      req.text,
      edgeProsody(req.emotion ?? "calm", req.intensity ?? 0.5, req.speaker, req.language),
    );
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("edge-tts timeout")), 25_000);
      audioStream.on("data", (c: Buffer) => chunks.push(c));
      audioStream.on("end", () => { clearTimeout(timer); resolve(); });
      audioStream.on("error", (e) => { clearTimeout(timer); reject(e); });
    });
    const audio = Buffer.concat(chunks);
    if (audio.length < 2048) throw new Error("edge-tts produced no audio");
    return { audio, mime: "audio/mpeg", provider: "edge", voice, cached: false };
  } catch (e) {
    console.warn(`[tts:edge] failed: ${String(e).slice(0, 160)}`);
    return null;
  } finally {
    try { tts.close(); } catch { /* noop */ }
  }
}

const PROVIDERS: Record<string, (r: TtsRequest) => Promise<TtsResult | null>> = {
  orpheus: synthOrpheus,
  elevenlabs: synthElevenLabs,
  edge: synthEdge,
};

/* ─────────────────────────── public entry point ─────────────────────────── */

/**
 * Synthesize speech for one turn, walking the provider chain until one
 * succeeds. Results are LRU-cached for instant replays.
 * Throws only if EVERY provider fails (client then uses browser TTS).
 */
export async function synthesize(req: TtsRequest): Promise<TtsResult> {
  const emotion = req.emotion ?? "calm";
  const intensity = req.intensity ?? 0.5;
  const cacheKey = sha256("tts", req.text, req.speaker, req.language, emotion, intensity.toFixed(1));

  const hit = audioCache.get(cacheKey);
  if (hit) {
    return {
      audio: Buffer.from(hit.b64, "base64"),
      mime: hit.mime,
      provider: hit.provider,
      voice: hit.voice,
      cached: true,
    };
  }

  const errors: string[] = [];
  for (const name of providerChain()) {
    const fn = PROVIDERS[name];
    if (!fn) continue;
    try {
      const result = await fn({ ...req, emotion, intensity });
      if (result && result.audio.length > 1024) {
        audioCache.set(cacheKey, {
          b64: result.audio.toString("base64"),
          mime: result.mime,
          provider: result.provider,
          voice: result.voice,
        }, result.audio.length);
        return result;
      }
      errors.push(`${name}: empty`);
    } catch (e) {
      errors.push(`${name}: ${String(e).slice(0, 100)}`);
    }
  }
  throw new Error("ALL_TTS_PROVIDERS_FAILED: " + errors.join(" | "));
}
