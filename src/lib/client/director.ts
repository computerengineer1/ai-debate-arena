/**
 * ─────────────────────────────────────────────────────────────────────
 *  Director — the showrunner.
 *
 *  Orchestrates the full cinematic sequence:
 *    generate script (Groq) → intro → 4 rounds × 2 turns
 *    (prefetching audio one turn ahead + verdict mid-show)
 *    → intermission → referee entrance → verdict → gavel → victory.
 *
 *  Handles pause/resume/restart/stop, TTS provider fallback to the
 *  browser voice engine, and drives the procedural score + store.
 * ─────────────────────────────────────────────────────────────────────
 */
"use client";

import { audioBus, base64ToBlobUrl, type PlayHandle } from "./audio";
import { score } from "./music";
import { useArenaStore } from "@/store/useArenaStore";
import type { AudioSegment, DebateConfig, DebateScript, Verdict } from "@/lib/types";

const api = {
  async script(cfg: DebateConfig, rematch: boolean): Promise<DebateScript> {
    const res = await fetch("/api/debate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "script", ...cfg, rematch }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Script failed (${res.status})`);
    return res.json();
  },
  async verdict(cfg: DebateConfig, script: DebateScript): Promise<Verdict> {
    const res = await fetch("/api/debate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "verdict", topic: cfg.topic, language: cfg.language, turns: script.turns }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Verdict failed (${res.status})`);
    return res.json();
  },
  async tts(text: string, speaker: string, language: string, emotion: string, intensity: number): Promise<AudioSegment> {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker, language, emotion, intensity }),
    });
    if (!res.ok) throw new Error(`TTS failed (${res.status})`);
    const j = await res.json();
    return {
      url: base64ToBlobUrl(j.audio, j.mime),
      durationSec: 0, // measured by the <audio> element on load
      provider: j.provider,
      voice: j.voice,
    };
  },
};

/** Pause-aware sleep. Resolves after `ms` of UNPAUSED time. */
function sleep(ms: number, alive: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    let accumulated = 0;
    let last = t0;
    const step = () => {
      if (!alive()) return resolve();
      const now = performance.now();
      if (!useArenaStore.getState().paused) accumulated += now - last;
      last = now;
      if (accumulated >= ms) return resolve();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

class Director {
  private runId = 0;
  private handle: PlayHandle | null = null;
  private audioCache = new Map<string, AudioSegment>();
  private verdictPromise: Promise<Verdict> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  get isRunning() {
    return ["generating", "intro", "speaking", "transition", "intermission", "referee_enter", "verdict_generating", "verdict", "gavel"].includes(useArenaStore.getState().phase);
  }

  /* ─────────────────────── controls ─────────────────────── */

  async start(cfg: DebateConfig, opts: { rematch?: boolean } = {}) {
    const myRun = ++this.runId;
    const alive = () => this.runId === myRun;
    this.audioCache.clear();
    this.verdictPromise = null;

    const st = useArenaStore.getState();
    st.reset();
    useArenaStore.getState().setConfig(cfg);

    // Audio context must be unlocked by the user gesture that got us here.
    const ctx = audioBus.init();
    score.start(ctx);
    score.setEnabled(useArenaStore.getState().musicOn);
    score.setIntensity(0.2);
    audioBus.setMuted(useArenaStore.getState().muted);

    if (!this.timer) this.timer = setInterval(() => useArenaStore.getState().tick(), 1000);

    try {
      useArenaStore.getState().setPhase("generating");
      const script = await api.script(cfg, !!opts.rematch);
      if (!alive()) return;
      useArenaStore.getState().setScript(script);

      // Kick off audio prefetch immediately (turn 0 + 1 in parallel)
      void this.prefetch(script, cfg, 0);
      void this.prefetch(script, cfg, 1);

      /* — intro: arena fly-in — */
      useArenaStore.getState().setPhase("intro");
      useArenaStore.getState().setRound(1);
      score.riser(2.2);
      await sleep(2600, alive);
      if (!alive()) return;

      /* — the 8 turns — */
      for (let i = 0; i < script.turns.length; i++) {
        if (!alive()) return;
        const turn = script.turns[i];

        // Round transition beat
        if (i > 0 && turn.round !== script.turns[i - 1].round) {
          useArenaStore.getState().setPhase("transition");
          useArenaStore.getState().setRound(turn.round);
          score.hit(0.7);
          await sleep(900, alive);
          if (!alive()) return;
        }

        // Fire the verdict generation during round 3 to hide latency
        if (turn.round === 3 && i === 4 && !this.verdictPromise) {
          this.verdictPromise = api.verdict(cfg, script).catch((e) => {
            this.verdictPromise = null;
            throw e;
          });
        }

        await this.playTurn(script, cfg, i, alive);
        if (!alive()) return;

        // Small breath between turns inside a round
        useArenaStore.getState().setPhase("transition");
        useArenaStore.getState().endTurn();
        score.duck(false);
        await sleep(i % 2 === 0 ? 700 : 500, alive);
      }
      if (!alive()) return;

      await this.finale(cfg, script, alive);
    } catch (e) {
      if (!alive()) return;
      console.error("[director]", e);
      useArenaStore.getState().fail(String((e as Error)?.message || e));
      score.stop();
    }
  }

  private async playTurn(script: DebateScript, cfg: DebateConfig, i: number, alive: () => boolean) {
    const turn = script.turns[i];
    const st = () => useArenaStore.getState();

    // Get audio (prefetched or on-demand)
    let seg: AudioSegment | null = null;
    try {
      seg = await this.getAudio(script, cfg, i);
    } catch {
      seg = null; // → browser fallback below
    }
    if (!alive()) return;

    st().startTurn(i);
    score.setIntensity(0.25 + turn.intensity * 0.6 + (turn.round - 1) * 0.05);
    score.duck(true);

    if (seg) {
      this.handle = audioBus.play(seg.url);
      // Prefetch next turns while this one plays
      void this.prefetch(script, cfg, i + 1);
      if (i % 2 === 0) void this.prefetch(script, cfg, i + 2);
      await this.handle.promise;
    } else {
      // Last-resort browser voice — lips still move (simulated envelope)
      st().markFallback();
      this.handle = audioBus.speakBrowser(turn.text, cfg.language, turn.speaker);
      await this.handle.promise;
    }
    this.handle = null;
  }

  private cacheKey(i: number) {
    return `t${i}`;
  }

  private async getAudio(script: DebateScript, cfg: DebateConfig, i: number): Promise<AudioSegment> {
    const k = this.cacheKey(i);
    const hit = this.audioCache.get(k);
    if (hit) return hit;
    const seg = await this.prefetch(script, cfg, i);
    if (!seg) throw new Error("no audio available for turn " + i);
    return seg;
  }

  /** Returns null (never throws) for out-of-range turns so void-prefetches
   *  at the end of the script can't produce unhandled rejections. */
  private async prefetch(script: DebateScript, cfg: DebateConfig, i: number): Promise<AudioSegment | null> {
    if (i < 0 || i >= script.turns.length) return null;
    const k = this.cacheKey(i);
    const existing = this.audioCache.get(k);
    if (existing) return existing;
    const t = script.turns[i];
    const seg = await api.tts(t.text, t.speaker, cfg.language, t.emotion, t.intensity);
    this.audioCache.set(k, seg);
    return seg;
  }

  /* ─────────────────────── the finale ─────────────────────── */

  private async finale(cfg: DebateConfig, script: DebateScript, alive: () => boolean) {
    const st = () => useArenaStore.getState();

    /* — intermission: dramatic silence, lights down — */
    st().setPhase("intermission");
    st().endTurn();
    score.duck(false);
    score.darken(true);
    score.setIntensity(0.05);
    await sleep(2600, alive);
    if (!alive()) return;

    /* — referee entrance — */
    st().setPhase("referee_enter");
    st().setRefereePresent(true);
    score.darken(false);
    score.riser(2.8);
    await sleep(1800, alive);
    if (!alive()) return;
    score.hit(1);
    await sleep(1200, alive);
    if (!alive()) return;

    /* — verdict generation (already prefetched during round 3) — */
    st().setPhase("verdict_generating");
    let verdict: Verdict;
    try {
      verdict = await (this.verdictPromise ?? api.verdict(cfg, script));
    } catch {
      // Retry once synchronously if the prefetch failed
      verdict = await api.verdict(cfg, script);
    }
    if (!alive()) return;
    st().setVerdict(verdict);

    /* — referee speaks the verdict — */
    st().setPhase("verdict");
    score.setIntensity(0.5);
    score.duck(true);
    let audio: AudioSegment | null = null;
    try {
      audio = await api.tts(verdict.verdict_text, "referee", cfg.language, "firm", 0.7);
    } catch {
      audio = null;
    }
    if (!alive()) return;
    if (audio) {
      this.handle = audioBus.play(audio.url);
      await this.handle.promise;
    } else {
      st().markFallback();
      this.handle = audioBus.speakBrowser(verdict.verdict_text, cfg.language, "referee");
      await this.handle.promise;
    }
    this.handle = null;
    if (!alive()) return;
    score.duck(false);

    /* — gavel slam + winner reveal — */
    st().setPhase("gavel");
    score.hit(1.3);
    await sleep(900, alive);
    if (!alive()) return;
    st().revealWinner();
    score.fanfare();
    score.setIntensity(0.9);
    await sleep(2200, alive);
    if (!alive()) return;

    /* — victory — */
    st().setPhase("victory");
  }

  /* ─────────────────────── transport ─────────────────────── */

  pause() {
    const st = useArenaStore.getState();
    if (!st.paused && this.isRunning) {
      st.setPaused(true);
      audioBus.pause();
      score.duck(false);
      if ("speechSynthesis" in window) window.speechSynthesis.pause();
    }
  }

  resume() {
    const st = useArenaStore.getState();
    if (st.paused) {
      st.setPaused(false);
      audioBus.resume();
      if (st.phase === "speaking" || st.phase === "verdict") score.duck(true);
      if ("speechSynthesis" in window) window.speechSynthesis.resume();
    }
  }

  togglePause() {
    useArenaStore.getState().paused ? this.resume() : this.pause();
  }

  stop() {
    this.runId++;
    this.handle?.stop();
    this.handle = null;
    score.stop();
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    useArenaStore.getState().reset();
    useArenaStore.getState().setPhase("stopped");
  }

  restart() {
    const cfg = useArenaStore.getState().config;
    if (cfg) void this.start(cfg, { rematch: true });
  }
}

export const director = new Director();
