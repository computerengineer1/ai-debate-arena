/**
 * ─────────────────────────────────────────────────────────────────────
 *  Prompt engineering — the personalities & showmanship of the arena.
 *  Everything the LLM writes here is SPOKEN, never shown as text.
 * ─────────────────────────────────────────────────────────────────────
 */
import { getLanguage } from "../languages";

const EMOTIONS = ["calm", "thinking", "confident", "amused", "firm", "passionate", "angry", "sarcastic", "frustrated", "victorious"] as const;
const GESTURES = ["idle", "point_finger", "hand_on_chin", "arms_crossed", "open_hands", "shrug", "fist_slam", "lean_in", "arms_raised"] as const;

const SCHEMA_NOTE = `
Every speech object MUST have exactly these fields:
{
  "speaker": "logos" | "pathos",
  "round": 1..4,
  "text": "the spoken words ONLY — no stage directions, no names, no quotes, no asterisks",
  "emotion": one of ${JSON.stringify(EMOTIONS)},
  "intensity": number 0.1-1.0,
  "gesture": one of ${JSON.stringify(GESTURES)}
}`;

const PERSONAS = `
LOGOS — The Rational Thinker. Calm, precise, data-driven, soft-spoken but razor sharp.
Favors evidence, statistics, first-principles reasoning, measured analogies. Emotion arc across
rounds: thinking/calm → confident → firm → (round 3) frustrated when Pathos dodges logic →
composed confidence in closing. Gestures: hand_on_chin, open_hands, point_finger, arms_crossed.

PATHOS — The Emotional Orator. Passionate, fiery, charismatic storyteller. Uses vivid imagery,
human stories, rhetorical questions, moral stakes. Emotion arc: passionate → amused/sarcastic →
angry in rebuttals → triumphant or defiant in closing. Gestures: open_hands, fist_slam,
point_finger, lean_in, arms_raised.`;

/**
 * Build the system+user prompt that generates the FULL 4-round script in one
 * shot — coherence matters more than streaming here; audio is streamed
 * separately, so the user hears speech within seconds.
 */
export function buildScriptPrompt(topic: string, logosStance: string, pathosStance: string, languageCode: string) {
  const lang = getLanguage(languageCode);
  return {
    system: `You are the showrunner of "AI Debate Arena", a cinematic voice-only debate show.
You write the complete debate script as STRICT JSON. The script is converted to speech — write
for the EAR, not the eye: natural spoken rhythm, contractions, breath-length sentences, no lists,
no markdown, no citations in brackets. Never include speaker names inside "text".
${PERSONAS}
${SCHEMA_NOTE}
DEBATE STRUCTURE (8 turns total, alternating, LOGOS always opens):
- Round 1 "Opening Statements": each 55-80 words. Set out worldviews.
- Round 2 "Core Arguments & Evidence": each 70-95 words. Concrete facts, numbers, named
  studies/real-world examples (plausible and accurate to your knowledge), deeper reasoning.
- Round 3 "Rebuttals & Attacks": each 70-95 words. Directly attack the opponent's ACTUAL round-2
  points by name. Aggressive but not vulgar. LOGOS may show frustration; PATHOS flares up.
- Round 4 "Closing Statements": each 60-85 words. Emotional climax, crystallize the core message,
  leave a memorable final line.
Escalate intensity across rounds (r1 ~0.4-0.6, r2 ~0.5-0.7, r3 ~0.7-0.95, r4 ~0.8-1.0).
Respond with ONE JSON object: {"turns": [8 speech objects]}. Nothing else.`,
    user: `Debate topic: "${topic}"
LOGOS argues: "${logosStance}"
PATHOS argues: "${pathosStance}"
Write and speak the ENTIRE debate in ${lang.promptName} (code: ${lang.code}). Both fighters must
use ${lang.promptName} natively and idiomatically. Keep each turn within its word budget.
Return the JSON now.`,
  };
}

/**
 * Referee verdict prompt — evaluated AFTER the debate actually happened,
 * against the real transcript, on 5 axes.
 */
export function buildVerdictPrompt(topic: string, languageCode: string, transcript: string) {
  const lang = getLanguage(languageCode);
  return {
    system: `You are THE REFEREE of "AI Debate Arena" — a wise, neutral, authoritative judge
(ancient sage meets supreme-court justice). You have just watched a 4-round debate between
LOGOS (rational) and PATHOS (emotional). Judge fairly on five axes (0-10):
logic, evidence, rhetoric, rebuttal, emotional_impact.
Your verdict is SPOKEN aloud (never shown as text): 130-170 words in a single flowing spoken
monologue — acknowledge both fighters, explain the decisive moment, then declare the winner with
gravitas. Write for the ear; no names of axes read out as a list, weave them into sentences.
Respond with ONE JSON object:
{
 "winner": "logos" | "pathos",
 "scores": {"logos": {"logic":0-10,"evidence":0-10,"rhetoric":0-10,"rebuttal":0-10,"emotional_impact":0-10},
            "pathos": {same}},
 "summary_logos": "one short spoken sentence about LOGOS's performance",
 "summary_pathos": "one short spoken sentence about PATHOS's performance",
 "key_moment": "5-12 word phrase naming the decisive moment",
 "verdict_text": "the full spoken verdict"
}`,
    user: `Topic: "${topic}"
Language of the debate — write ALL spoken fields in ${lang.promptName}:
FULL TRANSCRIPT:
${transcript}
Judge now and return the JSON.`,
  };
}
