/**
 * ─────────────────────────────────────────────────────────────────────
 *  Quality tiers — make the arena smooth on phones & weak laptops.
 *
 *  Tier is detected once at boot (cores / RAM / touch / UA) and a
 *  runtime GOVERNOR (see Stage.tsx) can downgrade further if the real
 *  measured FPS stays low: it drops pixel-ratio, kills dust/scanlines/
 *  glass-blur — the expensive bits on weak GPUs.
 * ─────────────────────────────────────────────────────────────────────
 */
"use client";

export type PerfTier = "low" | "medium" | "high";

function detect(): PerfTier {
  if (typeof navigator === "undefined") return "high";
  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  if (mobile || coarse) return cores <= 4 || mem <= 4 ? "low" : "medium";
  return cores <= 4 || mem <= 4 ? "medium" : "high";
}

export const perf = {
  tier: detect() as PerfTier,
  /** flipped by the runtime governor when measured FPS stays bad */
  dropped: false,

  get dpr(): [number, number] {
    if (this.dropped) return [0.75, 1];
    if (this.tier === "low") return [0.75, 1];
    if (this.tier === "medium") return [1, 1.5];
    return [1, 1.75];
  },
  get flames(): number {
    return this.tier === "low" ? 80 : this.tier === "medium" ? 170 : 260;
  },
  get sparks(): number {
    return this.tier === "low" ? 30 : this.tier === "medium" ? 60 : 90;
  },
  get confetti(): number {
    return this.tier === "low" ? 220 : this.tier === "medium" ? 450 : 700;
  },
  get ringTicks(): number {
    return this.tier === "low" ? 14 : this.tier === "medium" ? 24 : 36;
  },
  get dust(): boolean {
    return this.tier !== "low" && !this.dropped;
  },
  get particleDivisor(): number {
    return this.tier === "low" ? 52000 : this.tier === "medium" ? 36000 : 28000;
  },

  /** Runtime emergency downgrade (called by PerfGovernor). */
  drop() {
    if (this.dropped) return;
    this.dropped = true;
    if (typeof document !== "undefined") {
      document.documentElement.dataset.perf = "low"; // CSS: kill scanlines + glass blur
    }
  },
};
