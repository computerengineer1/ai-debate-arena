/**
 * POST /api/debate
 *  mode=script  → generates the full 4-round debate script (8 turns)
 *  mode=verdict → referee evaluates the real transcript, returns verdict
 * Server-side Groq proxy. The API key never touches the browser.
 */
import { NextRequest, NextResponse } from "next/server";
import { groqJson, modelChain } from "@/lib/server/groq";
import { buildScriptPrompt, buildVerdictPrompt } from "@/lib/server/prompts";
import { getCache, sha256 } from "@/lib/server/cache";
import { SUPPORTED_LANGUAGE_CODES } from "@/lib/languages";
import type { DebateScript, DebateTurn, Emotion, Gesture, Verdict } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel: allow long generations

const scriptCache = getCache<DebateScript>("script");
const verdictCache = getCache<Verdict>("verdict");

const VALID_EMOTIONS: Emotion[] = ["calm", "thinking", "confident", "amused", "firm", "passionate", "angry", "sarcastic", "frustrated", "victorious"];
const VALID_GESTURES: Gesture[] = ["idle", "point_finger", "hand_on_chin", "arms_crossed", "open_hands", "shrug", "fist_slam", "lean_in", "arms_raised"];

interface RawTurn {
  speaker?: string; round?: number; text?: string;
  emotion?: string; intensity?: number; gesture?: string;
}

/** Sanitize + harden a raw model turn into a typed DebateTurn. */
function hardenTurn(raw: RawTurn, index: number): DebateTurn | null {
  const text = String(raw.text ?? "").trim();
  if (!text || text.length < 20) return null;
  // Normalize speaker labels: "PATHOS", "Pathos", "pathos", "con" → pathos
  const sp = String(raw.speaker ?? "").trim().toLowerCase();
  const speaker: "logos" | "pathos" = /^(p|pathos|con|against|opponent)/.test(sp) ? "pathos" : "logos";
  const round = Math.min(4, Math.max(1, Math.floor(Number(raw.round) || Math.floor(index / 2) + 1)));
  return {
    speaker,
    round,
    // Safety: strip any accidental stage directions / markdown from spoken text
    text: text.replace(/[*_#`]/g, "").replace(/\[(?!\/?\w+\s*\])[^[\]]*\]/g, "").trim().slice(0, 1200),
    emotion: (VALID_EMOTIONS as string[]).includes(raw.emotion ?? "") ? (raw.emotion as Emotion) : "calm",
    intensity: Math.min(1, Math.max(0.1, Number(raw.intensity) || 0.5)),
    gesture: (VALID_GESTURES as string[]).includes(raw.gesture ?? "") ? (raw.gesture as Gesture) : "idle",
  };
}

/**
 * Assemble the canonical 8-turn structure (LOGOS opens every round).
 * Strategy A: trust the model's round/speaker labels.
 * Strategy B (fallback): pair turns strictly by arrival order.
 */
function assembleTurns(turns: DebateTurn[]): DebateTurn[] {
  const byLabel: DebateTurn[] = [];
  for (let r = 1; r <= 4; r++) {
    const logos = turns.find((t) => t.round === r && t.speaker === "logos");
    const pathos = turns.find((t) => t.round === r && t.speaker === "pathos");
    if (logos) byLabel.push({ ...logos, round: r, speaker: "logos" });
    if (pathos) byLabel.push({ ...pathos, round: r, speaker: "pathos" });
  }
  if (byLabel.length === 8) return byLabel;

  const byOrder = turns.slice(0, 8).map((t, i) => ({
    ...t,
    speaker: (i % 2 === 0 ? "logos" : "pathos") as "logos" | "pathos",
    round: Math.floor(i / 2) + 1,
  }));
  return byOrder.length === 8 ? byOrder : byLabel;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = body.mode === "verdict" ? "verdict" : "script";
  const language = String(body.language ?? "en");
  if (!SUPPORTED_LANGUAGE_CODES.includes(language)) {
    return NextResponse.json({ error: `Unsupported language: ${language}` }, { status: 400 });
  }

  try {
    /* ─────────────── MODE: full debate script ─────────────── */
    if (mode === "script") {
      const topic = String(body.topic ?? "").trim().slice(0, 300);
      const logosStance = String(body.logosStance ?? "").trim().slice(0, 300);
      const pathosStance = String(body.pathosStance ?? "").trim().slice(0, 300);
      const rematch = body.rematch === true; // bust cache for a fresh take
      if (topic.length < 3) {
        return NextResponse.json({ error: "Topic too short" }, { status: 400 });
      }

      const key = sha256("script", topic, logosStance, pathosStance, language, rematch ? Date.now() : "");
      const cached = !rematch && scriptCache.get(key);
      if (cached) return NextResponse.json({ ...cached, cached: true });

      const prompt = buildScriptPrompt(topic, logosStance || `PRO: "${topic}"`, pathosStance || `CON: "${topic}"`, language);

      // Up to 2 attempts: if a model returns fewer than the canonical 8
      // turns (or we hit a rate-limit 429), re-ask with a repair directive.
      let script: DebateScript | null = null;
      for (let attempt = 0; attempt < 3 && !script; attempt++) {
        const { data, model } = await groqJson<Record<string, unknown>>({
          system: prompt.system,
          user: attempt === 0
            ? prompt.user
            : prompt.user + "\n\nIMPORTANT: Your previous answer was incomplete or malformed. Return EXACTLY 8 turn objects — 4 rounds × (logos, pathos) — with all fields. No fewer, no more.",
          models: modelChain(language),
          temperature: 0.95,
          maxTokens: 3600,
        });

        // Flexible extraction: flat turns[] OR rounds[{turns[] | logos{}, pathos{}}]
        const rawTurns: (RawTurn & { round?: number })[] = [];
        if (Array.isArray(data.turns)) {
          rawTurns.push(...(data.turns as RawTurn[]));
        } else if (Array.isArray(data.rounds)) {
          for (const r0 of data.rounds as Record<string, unknown>[]) {
            const rn = Number(r0.round) || 0;
            if (Array.isArray(r0.turns)) {
              rawTurns.push(...(r0.turns as RawTurn[]).map((t) => ({ ...t, round: t.round ?? rn })));
            }
            for (const sp of ["logos", "pathos"] as const) {
              const t = r0[sp];
              if (t && typeof t === "object") rawTurns.push({ ...(t as RawTurn), speaker: sp, round: (t as RawTurn).round ?? rn });
            }
          }
        }

        const turns = rawTurns.map(hardenTurn).filter((t): t is DebateTurn => t !== null);
        const candidate: DebateScript = {
          topic, language, logosStance, pathosStance,
          turns: assembleTurns(turns), model,
        };
        if (candidate.turns.length === 8) script = candidate;
        else console.warn(`[api/debate] attempt ${attempt + 1}: got ${candidate.turns.length}/8 turns from ${model} (raw ${rawTurns.length}, hardened ${turns.length})`);
      }

      if (!script) {
        return NextResponse.json({ error: "Model returned an incomplete script — retry" }, { status: 502 });
      }

      scriptCache.set(key, script);
      return NextResponse.json(script);
    }

    /* ─────────────── MODE: referee verdict ─────────────── */
    const topic = String(body.topic ?? "").trim().slice(0, 300);
    const turns = Array.isArray(body.turns) ? (body.turns as DebateTurn[]) : [];
    if (turns.length < 4) {
      return NextResponse.json({ error: "Transcript too short for a verdict" }, { status: 400 });
    }
    const transcript = turns
      .map((t) => `[${t.speaker.toUpperCase()} R${t.round}]: ${String(t.text).slice(0, 900)}`)
      .join("\n");

    const key = sha256("verdict", topic, language, transcript);
    const cached = verdictCache.get(key);
    if (cached) return NextResponse.json({ ...cached, cached: true });

    const prompt = buildVerdictPrompt(topic, language, transcript);
    const { data } = await groqJson<Verdict>({
      ...prompt,
      models: modelChain(language),
      temperature: 0.6, // judges should be steadier than fighters
      maxTokens: 2200,
    });

    const clamp = (n: unknown) => Math.min(10, Math.max(0, Math.round(Number(n) || 5)));
    const verdict: Verdict = {
      winner: data.winner === "pathos" ? "pathos" : "logos",
      scores: {
        logos: { ...data.scores?.logos, logic: clamp(data.scores?.logos?.logic), evidence: clamp(data.scores?.logos?.evidence), rhetoric: clamp(data.scores?.logos?.rhetoric), rebuttal: clamp(data.scores?.logos?.rebuttal), emotional_impact: clamp(data.scores?.logos?.emotional_impact) },
        pathos: { ...data.scores?.pathos, logic: clamp(data.scores?.pathos?.logic), evidence: clamp(data.scores?.pathos?.evidence), rhetoric: clamp(data.scores?.pathos?.rhetoric), rebuttal: clamp(data.scores?.pathos?.rebuttal), emotional_impact: clamp(data.scores?.pathos?.emotional_impact) },
      },
      summary_logos: String(data.summary_logos ?? "").slice(0, 300),
      summary_pathos: String(data.summary_pathos ?? "").slice(0, 300),
      key_moment: String(data.key_moment ?? "").slice(0, 120),
      verdict_text: String(data.verdict_text ?? "").replace(/[*_#`]/g, "").trim().slice(0, 1600),
    };
    if (verdict.verdict_text.length < 40) {
      return NextResponse.json({ error: "Referee produced no verdict" }, { status: 502 });
    }

    verdictCache.set(key, verdict);
    return NextResponse.json(verdict);
  } catch (e) {
    console.error("[api/debate]", e);
    const msg = String(e);
    const status = /GROQ_401|GROQ_403/.test(msg) ? 500 : 502;
    return NextResponse.json(
      { error: msg.includes("GROQ_API_KEY missing") ? "Server missing GROQ_API_KEY — see .env.example" : "Debate generation failed", detail: msg.slice(0, 300) },
      { status },
    );
  }
}
