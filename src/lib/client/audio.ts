/**
 * ─────────────────────────────────────────────────────────────────────
 *  AudioBus — the arena's single audio spine (client-side singleton).
 *
 *  speech blob → <audio> → MediaElementSource → Analyser → master → out
 *                                   │
 *                                   └→ RMS level @60fps → lip-sync +
 *                                      chest-core pulse + music ducking
 *
 *  Also implements the last-resort "browser" provider (Web Speech API)
 *  with a simulated syllable envelope so lips still move if every
 *  server voice provider is down.
 * ─────────────────────────────────────────────────────────────────────
 */
import type { Speaker } from "../types";

export interface PlayHandle {
  promise: Promise<void>;
  stop: () => void;
}

class AudioBus {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private el: HTMLAudioElement | null = null;
  private src: MediaElementAudioSourceNode | null = null;
  private raf = 0;
  private timeDomain: Uint8Array = new Uint8Array(512);

  /** Live RMS level 0..1 — mutated outside React for 60fps reads. */
  level = 0;
  speaking = false;
  muted = false;

  /** Must be called from a user gesture (click) to satisfy autoplay rules. */
  init(): AudioContext {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 1;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;

    const el = new Audio();
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    const src = ctx.createMediaElementSource(el);
    src.connect(analyser);
    analyser.connect(master);
    master.connect(ctx.destination);

    this.ctx = ctx; this.master = master; this.analyser = analyser; this.el = el; this.src = src;
    this.startLevelLoop();
    return ctx;
  }

  get context() {
    return this.ctx;
  }

  private startLevelLoop() {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      if (!this.analyser || !this.speaking) {
        this.level += (0 - this.level) * 0.25; // release
        return;
      }
      this.analyser.getByteTimeDomainData(this.timeDomain as Uint8Array<ArrayBuffer>);
      let sum = 0;
      for (let i = 0; i < this.timeDomain.length; i++) {
        const v = (this.timeDomain[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / this.timeDomain.length);
      const target = Math.min(1, rms * 4.5); // normalize speech RMS
      // Fast attack, slower release = snappy lips, natural close
      this.level += (target - this.level) * (target > this.level ? 0.55 : 0.18);
    };
    this.raf = requestAnimationFrame(tick);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }

  /* ── autoplay-policy machinery: blocked playback waits for a gesture ── */
  private gestureResolvers: Array<() => void> = [];
  private resolveCurrentPlay: (() => void) | null = null;

  /** Called by the page on the first pointerdown/keydown. */
  notifyGesture() {
    const rs = this.gestureResolvers.splice(0);
    for (const r of rs) r();
  }

  /** Resolves as soon as the user interacts (or after a safety timeout). */
  private waitForGesture(timeoutMs = 25_000): Promise<void> {
    if (this.ctx && this.ctx.state === "running") return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        this.gestureResolvers = this.gestureResolvers.filter((r) => r !== done);
        resolve();
      }, timeoutMs);
      this.gestureResolvers.push(done);
    });
  }

  /** Play a synthesized audio blob URL. Resolves when finished. */
  play(url: string): PlayHandle {
    this.init();
    const el = this.el!;
    let stopped = false;
    el.src = url;
    const promise = new Promise<void>((resolve) => {
      const done = () => {
        if (stopped) return;
        stopped = true;
        this.speaking = false;
        if (this.resolveCurrentPlay === done) this.resolveCurrentPlay = null;
        el.removeEventListener("ended", done);
        el.removeEventListener("error", done);
        resolve();
      };
      this.resolveCurrentPlay = done;
      el.addEventListener("ended", done);
      el.addEventListener("error", done);
      this.speaking = true;
      el.play().catch(async () => {
        // Autoplay-blocked → wait for the user's first gesture, then retry
        await this.waitForGesture();
        if (stopped) return done();
        if (this.ctx?.state === "suspended") await this.ctx.resume().catch(() => undefined);
        el.play().catch(() => done());
      });
    });
    return {
      promise,
      stop: () => {
        stopped = true;
        this.speaking = false;
        el.pause();
        el.src = "";
      },
    };
  }

  pause() { this.el?.pause(); }
  resume() { void this.el?.play().catch(() => undefined); }
  stop() {
    this.speaking = false;
    if (this.el) { this.el.pause(); this.el.removeAttribute("src"); }
    // Never leave a director loop awaiting a play that will never end
    const r = this.resolveCurrentPlay;
    this.resolveCurrentPlay = null;
    r?.();
  }

  /* ─────────── last-resort: browser Web Speech API fallback ─────────── */

  private browserVoicesCache: SpeechSynthesisVoice[] = [];

  pickBrowserVoice(lang: string, speaker: Speaker): SpeechSynthesisVoice | null {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    if (!this.browserVoicesCache.length) this.browserVoicesCache = window.speechSynthesis.getVoices();
    const vs = this.browserVoicesCache.filter((v) => v.lang.toLowerCase().startsWith(lang));
    if (!vs.length) return this.browserVoicesCache[0] ?? null;
    // Rough casting: deep male for logos/referee, any for pathos
    const male = vs.find((v) => /male|guy|david|daniel|christopher/i.test(v.name) && !/female/i.test(v.name));
    const female = vs.find((v) => /female|zira|samantha|aria/i.test(v.name));
    if (speaker === "pathos") return female ?? male ?? vs[0];
    return male ?? vs[0];
  }

  /** Speak via Web Speech API with a simulated syllable envelope for lips. */
  speakBrowser(text: string, lang: string, speaker: Speaker): PlayHandle {
    let stopped = false;
    let sim: number | undefined;
    const promise = new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      const v = this.pickBrowserVoice(lang, speaker);
      if (v) u.voice = v;
      u.lang = v?.lang ?? lang;
      u.rate = speaker === "referee" ? 0.85 : speaker === "logos" ? 0.9 : 1.05;
      u.pitch = speaker === "referee" ? 0.8 : speaker === "logos" ? 0.85 : 1.15;
      u.onend = () => { stopped = true; if (sim) cancelAnimationFrame(sim); this.speaking = false; this.level = 0; resolve(); };
      u.onerror = u.onend;
      this.speaking = true;
      // Simulated mouth envelope (analyser can't see speechSynthesis output)
      let t0 = performance.now();
      const animate = () => {
        if (stopped) return;
        const t = (performance.now() - t0) / 1000;
        const syllable = 0.5 + 0.5 * Math.sin(t * 14 + Math.sin(t * 5.7) * 2.2);
        const jitter = Math.random() * 0.25;
        this.level = Math.min(1, syllable * 0.7 + jitter * 0.4);
        sim = requestAnimationFrame(animate);
      };
      t0 = performance.now();
      animate();
      window.speechSynthesis.speak(u);
    });
    return {
      promise,
      stop: () => {
        stopped = true;
        if (sim) cancelAnimationFrame(sim);
        this.speaking = false;
        this.level = 0;
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      },
    };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}

/** Singleton — import from client components only. */
export const audioBus = new AudioBus();

/** Convert a base64 TTS payload into a playable object URL. */
export function base64ToBlobUrl(b64: string, mime: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}
