/**
 * ─────────────────────────────────────────────────────────────────────
 *  Score — a fully procedural cinematic soundtrack (Web Audio only,
 *  zero audio assets). Layers:
 *    • drone pad      — detuned saws through a low-pass (the "arena hum")
 *    • heartbeat      — sub-kick pulsing at a BPM that rises with tension
 *    • shimmer        — high tension layer, gain follows intensity
 *    • noise swell    — airy riser during heated rounds
 *    • hits           — gavel slams, round transitions, verdict stingers
 *    • fanfare/dance  — victory sequence & the easter-egg disco mode
 *  The voice mix DUCKS the music automatically while a fighter speaks.
 * ─────────────────────────────────────────────────────────────────────
 */

type Scheduler = ReturnType<typeof setInterval>;

class Score {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private shimmerGain: GainNode | null = null;
  private swellGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private beatTimer: Scheduler | null = null;
  private nextBeat = 0;
  private beatCount = 0;

  intensity = 0.25;
  running = false;
  dance = false;
  enabled = true;

  start(ctx: AudioContext) {
    if (this.running) return;
    this.ctx = ctx;
    this.running = true;

    const master = ctx.createGain();
    master.gain.value = this.enabled ? 0.0001 : 0;
    master.connect(ctx.destination);
    this.master = master;
    if (this.enabled) master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 2.5);

    // 16-bit white noise buffer (1s) for swells/hits/hats
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;

    /* — drone pad: A1 root + fifth + octave, slowly detuned — */
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.16;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 240;
    filter.Q.value = 1.2;
    filter.connect(droneGain);
    droneGain.connect(master);
    for (const [freq, detune, type] of [
      [55, -6, "sawtooth"], [55, 7, "sawtooth"], [82.4, 0, "triangle"], [110, 4, "sine"],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = type === "sine" ? 0.5 : 0.22;
      o.connect(g); g.connect(filter);
      // Slow chorusing LFO
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.08;
      const lg = ctx.createGain();
      lg.gain.value = 3;
      lfo.connect(lg); lg.connect(o.detune);
      o.start(); lfo.start();
    }
    this.droneGain = droneGain;
    this.droneFilter = filter;

    /* — shimmer (tension) — */
    const sh = ctx.createGain();
    sh.gain.value = 0;
    sh.connect(master);
    for (const f of [659.3, 987.8, 1318.5]) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      o.detune.value = Math.random() * 10 - 5;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      o.connect(g); g.connect(sh);
      o.start();
    }
    this.shimmerGain = sh;

    /* — airy noise swell — */
    const swellSrc = ctx.createBufferSource();
    swellSrc.buffer = nb;
    swellSrc.loop = true;
    const swellFilter = ctx.createBiquadFilter();
    swellFilter.type = "bandpass";
    swellFilter.frequency.value = 900;
    swellFilter.Q.value = 0.7;
    const swellGain = ctx.createGain();
    swellGain.gain.value = 0;
    swellSrc.connect(swellFilter); swellFilter.connect(swellGain); swellGain.connect(master);
    swellSrc.start();
    this.swellGain = swellGain;

    /* — heartbeat scheduler (lookahead, sample-accurate) — */
    this.nextBeat = ctx.currentTime;
    this.beatTimer = setInterval(() => this.scheduleBeats(), 100);
  }

  private scheduleBeats() {
    if (!this.ctx || !this.running) return;
    const bpm = this.dance ? 124 : 46 + this.intensity * 44;
    const spb = 60 / bpm;
    while (this.nextBeat < this.ctx.currentTime + 0.25) {
      this.kick(this.nextBeat, this.dance ? 0.5 : 0.28 + this.intensity * 0.2);
      if (this.dance && this.beatCount % 2 === 1) this.hat(this.nextBeat, 0.14);
      if (!this.dance && this.intensity > 0.7 && this.beatCount % 2 === 1) this.hat(this.nextBeat, 0.05 * this.intensity);
      this.nextBeat += spb;
      this.beatCount++;
    }
  }

  private kick(at: number, gain = 0.3) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(this.dance ? 110 : 62, at);
    o.frequency.exponentialRampToValueAtTime(34, at + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.32);
    o.connect(g); g.connect(this.master);
    o.start(at); o.stop(at + 0.35);
  }

  private hat(at: number, gain = 0.1) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(at); s.stop(at + 0.08);
  }

  /** Smoothly drive tension 0..1 (round intensity). */
  setIntensity(x: number) {
    this.intensity = Math.min(1, Math.max(0, x));
    if (!this.ctx || !this.running) return;
    const t = this.ctx.currentTime;
    this.shimmerGain?.gain.setTargetAtTime(this.dance ? 0.02 : this.intensity * 0.05, t, 1.2);
    this.swellGain?.gain.setTargetAtTime(this.dance ? 0 : Math.max(0, this.intensity - 0.45) * 0.06, t, 1.2);
    this.droneFilter?.frequency.setTargetAtTime(this.dance ? 900 : 200 + this.intensity * 500, t, 1.0);
    this.droneGain?.gain.setTargetAtTime(this.dance ? 0.1 : 0.14 + this.intensity * 0.08, t, 1.0);
  }

  /** Duck music under speech (or lift back up). */
  duck(on: boolean) {
    if (!this.ctx || !this.master || !this.enabled) return;
    this.master.gain.setTargetAtTime(on ? 0.3 : 0.9, this.ctx.currentTime, 0.15);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(on ? 0.9 : 0.0001, this.ctx.currentTime, 0.2);
  }

  /** Cinematic impact: gavel slam / round change / verdict stinger. */
  hit(strength = 1) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    // Low boom
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(120 * strength, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.75 * strength, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 1);
    // Crack
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 3500;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.4 * strength, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    s.connect(f); f.connect(ng); ng.connect(this.master);
    s.start(t); s.stop(t + 0.3);
  }

  /** Rising whoosh (referee entrance). */
  riser(seconds = 2.2) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 2;
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(4200, t + seconds);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + seconds * 0.92);
    g.gain.exponentialRampToValueAtTime(0.001, t + seconds + 0.25);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + seconds + 0.3);
  }

  /** Victory fanfare: C-G-C-E brass-ish arpeggio + shimmer. */
  fanfare() {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + 0.05;
    const notes = [261.6, 392, 523.3, 659.3, 784, 1046.5];
    notes.forEach((f, i) => {
      const t = t0 + i * 0.16;
      const o = this.ctx!.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      const lp = this.ctx!.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(600, t);
      lp.frequency.exponentialRampToValueAtTime(3400, t + 0.12);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(i === notes.length - 1 ? 0.3 : 0.18, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + (i === notes.length - 1 ? 1.6 : 0.35));
      o.connect(lp); lp.connect(g); g.connect(this.master!);
      o.start(t); o.stop(t + 1.7);
    });
  }

  /** Easter-egg disco mode. */
  setDance(on: boolean) {
    this.dance = on;
    this.setIntensity(on ? 0.9 : this.intensity);
  }

  /** Intermission: everything drops to near-silence. */
  darken(on: boolean) {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(on ? 0.12 : 0.9, this.ctx.currentTime, 0.8);
  }

  stop() {
    this.running = false;
    if (this.beatTimer) clearInterval(this.beatTimer);
    this.beatTimer = null;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
    }
  }
}

export const score = new Score();
