/**
 * ─────────────────────────────────────────────────────────────────────
 *  Arena store — single source of truth for the show (zustand).
 *  The Director writes; the 3D stage, HUD and overlays read via
 *  selectors. High-frequency data (voice level) intentionally lives
 *  OUTSIDE the store (audioBus.level) to avoid 60fps re-renders.
 * ─────────────────────────────────────────────────────────────────────
 */
"use client";

import { create } from "zustand";
import type {
  DebateConfig, DebateScript, Emotion, Gesture, Phase, Speaker, Verdict,
} from "@/lib/types";

export interface TurnPerformance {
  speaker: Speaker;
  round: number;
  emotion: Emotion;
  intensity: number;
  gesture: Gesture;
}

interface ArenaState {
  /* show config + script */
  config: DebateConfig | null;
  script: DebateScript | null;
  verdict: Verdict | null;

  /* playback state */
  phase: Phase;
  turnIndex: number; // -1 = none
  performance: TurnPerformance | null; // current speaking turn's tags
  round: number; // 1..4 (0 = pre/post)
  refereePresent: boolean;

  /* controls */
  paused: boolean;
  muted: boolean;
  musicOn: boolean;
  danceMode: boolean;

  /* meta */
  startedAt: number | null;
  elapsedSec: number;
  error: string | null;
  ttsFallback: boolean; // true if browser TTS was used for any turn
  winnerRevealed: boolean;

  /* actions */
  setConfig: (c: DebateConfig) => void;
  setPhase: (p: Phase) => void;
  setScript: (s: DebateScript) => void;
  setVerdict: (v: Verdict) => void;
  startTurn: (index: number) => void;
  endTurn: () => void;
  setRound: (r: number) => void;
  setRefereePresent: (v: boolean) => void;
  setPaused: (v: boolean) => void;
  setMuted: (v: boolean) => void;
  setMusicOn: (v: boolean) => void;
  setDanceMode: (v: boolean) => void;
  tick: () => void;
  markFallback: () => void;
  revealWinner: () => void;
  fail: (msg: string) => void;
  reset: () => void;
}

const initial = {
  config: null, script: null, verdict: null,
  phase: "idle" as Phase, turnIndex: -1, performance: null, round: 0,
  refereePresent: false,
  paused: false, muted: false, musicOn: true, danceMode: false,
  startedAt: null, elapsedSec: 0, error: null, ttsFallback: false,
  winnerRevealed: false,
};

export const useArenaStore = create<ArenaState>((set, get) => ({
  ...initial,

  setConfig: (config) => set({ config, startedAt: Date.now(), elapsedSec: 0 }),
  setPhase: (phase) => set({ phase }),
  setScript: (script) => set({ script }),
  setVerdict: (verdict) => set({ verdict }),

  startTurn: (index) => {
    const s = get().script;
    const turn = s?.turns[index];
    if (!turn) return set({ turnIndex: index });
    set({
      turnIndex: index,
      phase: "speaking",
      round: turn.round,
      performance: {
        speaker: turn.speaker,
        round: turn.round,
        emotion: turn.emotion,
        intensity: turn.intensity,
        gesture: turn.gesture,
      },
    });
  },

  endTurn: () => set({ performance: null }),
  setRound: (round) => set({ round }),
  setRefereePresent: (refereePresent) => set({ refereePresent }),
  setPaused: (paused) => set({ paused }),
  setMuted: (muted) => set({ muted }),
  setMusicOn: (musicOn) => set({ musicOn }),
  setDanceMode: (danceMode) => set({ danceMode }),

  tick: () => {
    const { startedAt, paused } = get();
    if (!startedAt || paused) return;
    set({ elapsedSec: Math.floor((Date.now() - startedAt) / 1000) });
  },

  markFallback: () => set({ ttsFallback: true }),
  revealWinner: () => set({ winnerRevealed: true }),
  fail: (msg) => set({ phase: "error", error: msg }),

  reset: () => set({ ...initial, config: get().config }),
}));

/** Non-reactive snapshot helper for useFrame loops. */
export const arenaState = () => useArenaStore.getState();
