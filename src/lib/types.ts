/**
 * ─────────────────────────────────────────────────────────────────────
 *  AI DEBATE ARENA — shared type system
 *  Used by both the server (Groq/TTS routes) and the client (director,
 *  3D stage, HUD). Keep this file dependency-free.
 * ─────────────────────────────────────────────────────────────────────
 */

/** The three AI entities of the arena. */
export type Speaker = "logos" | "pathos" | "referee";

/** Emotional states returned by the Groq-powered debate engine. */
export type Emotion =
  | "calm"
  | "thinking"
  | "confident"
  | "amused"
  | "firm"
  | "passionate"
  | "angry"
  | "sarcastic"
  | "frustrated"
  | "victorious";

/** Physical gesture cues that drive avatar animation clips/poses. */
export type Gesture =
  | "idle"
  | "point_finger"
  | "hand_on_chin"
  | "arms_crossed"
  | "open_hands"
  | "shrug"
  | "fist_slam"
  | "lean_in"
  | "arms_raised";

/** A single emotional/performative unit of speech. */
export interface PerformanceTags {
  emotion: Emotion;
  /** 0.1 → 1.0. Drives voice prosody, lighting, camera shake, music. */
  intensity: number;
  gesture: Gesture;
}

/** One turn of speech inside a round. */
export interface DebateTurn extends PerformanceTags {
  speaker: Speaker;
  /** Round index 1..4 */
  round: number;
  /** The spoken text — NEVER rendered on screen (voice-only performance). */
  text: string;
}

/** The full script produced by /api/debate (mode=script). */
export interface DebateScript {
  topic: string;
  language: string;
  logosStance: string;
  pathosStance: string;
  turns: DebateTurn[];
  /** Raw model used, for debugging */
  model?: string;
}

/** Referee scoring dimensions (0-10 each). */
export interface VerdictScores {
  logic: number;
  evidence: number;
  rhetoric: number;
  rebuttal: number;
  emotional_impact: number;
}

/** Referee verdict produced by /api/debate (mode=verdict). */
export interface Verdict {
  winner: "logos" | "pathos";
  scores: { logos: VerdictScores; pathos: VerdictScores };
  /** 1-2 sentence spoken summary per fighter (voice only) */
  summary_logos: string;
  summary_pathos: string;
  /** The full spoken verdict (30-60s of speech) */
  verdict_text: string;
  key_moment: string;
}

/** Lifecycle of the whole cinematic experience. */
export type Phase =
  | "idle" // landing / nothing running
  | "generating" // Groq is writing the debate
  | "intro" // arena fly-in before round 1
  | "speaking" // a turn is being performed
  | "transition" // short beat between turns/rounds
  | "intermission" // dramatic silence, lights down
  | "referee_enter" // epic entrance animation
  | "verdict_generating" // referee is deliberating (Groq call)
  | "verdict" // referee is speaking the verdict
  | "gavel" // gavel slam + winner reveal
  | "victory" // confetti, trophy, dance easter egg
  | "stopped" // user aborted
  | "error";

/** A debate configuration chosen on the landing page. */
export interface DebateConfig {
  topic: string;
  logosStance: string;
  pathosStance: string;
  /** BCP-47-ish language code, e.g. "en" | "ar" | "zh" */
  language: string;
}

/** Client-side enriched segment = script turn + synthesized audio info. */
export interface AudioSegment {
  url: string; // object URL of the synthesized audio
  durationSec: number;
  provider: string; // which voice engine served it
  voice: string;
}

/** What /api/tts responds with. */
export interface TtsResponse {
  audio: string; // base64 of the audio file
  mime: string;
  provider: string;
  voice: string;
  cached?: boolean;
}
