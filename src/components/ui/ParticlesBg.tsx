/**
 * ParticlesBg — lightweight 2D canvas particle field for the landing page
 * (nodes + drifting links, cyan/fuchsia/gold palette). Respects
 * prefers-reduced-motion and pauses when the tab is hidden.
 */
"use client";

import { useEffect, useRef } from "react";
import { perf } from "@/lib/client/quality";

interface P { x: number; y: number; vx: number; vy: number; r: number; c: string }

export default function ParticlesBg() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let w = (canvas.width = canvas.offsetWidth * devicePixelRatio);
    let h = (canvas.height = canvas.offsetHeight * devicePixelRatio);
    const COLORS = ["#22d3ee", "#f472b6", "#fbbf24", "#818cf8"];
    const N = Math.min(perf.tier === "high" ? 120 : 60, Math.floor((w * h) / perf.particleDivisor));
    const ps: P[] = Array.from({ length: N }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: (Math.random() * 1.6 + 0.6) * devicePixelRatio,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    let raf = 0;
    let running = true;
    const onResize = () => {
      w = canvas.width = canvas.offsetWidth * devicePixelRatio;
      h = canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    const onVis = () => { running = !document.hidden; };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);

    const LINK = 130 * devicePixelRatio;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = 0.7;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.lineWidth = devicePixelRatio * 0.5;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const dx = ps[i].x - ps[j].x;
          const dy = ps[i].y - ps[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx.beginPath();
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(ps[j].x, ps[j].y);
            ctx.strokeStyle = "#22d3ee";
            ctx.globalAlpha = 0.09 * (1 - Math.sqrt(d2) / LINK);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />;
}
