/**
 * /arena — the debate stage.
 * Renders the 3D scene, HUD, transport controls and cinematic overlays.
 * NO speech text is ever rendered here: voice + performance only.
 *
 * Lifecycle rules (learned the hard way):
 *  • React StrictMode (dev) double-invokes effects on mount — the audio
 *    teardown must NOT run on the simulated unmount, or the show dies at
 *    birth. We defer teardown by a tick and cancel it if we remount.
 *  • A page RELOAD must not auto-restart the debate behind the user's
 *    back: on reload we show a one-click RESUME card (which also gives
 *    us a real user gesture → autoplay-policy-safe audio).
 */
"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import HUD from "@/components/ui/HUD";
import ControlBar from "@/components/ui/ControlBar";
import Overlays from "@/components/ui/Overlays";
import { director } from "@/lib/client/director";
import { audioBus } from "@/lib/client/audio";
import { score } from "@/lib/client/music";
import { useArenaStore } from "@/store/useArenaStore";
import { useT } from "@/lib/client/useT";
import { guestToken } from "@/lib/client/useQuota";
import { useSession } from "next-auth/react";
import AuthModal from "@/components/ui/AuthModal";
import PricingModal from "@/components/ui/PricingModal";
import type { DebateConfig } from "@/lib/types";

const ArenaCanvas = dynamic(() => import("@/components/three/ArenaCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center bg-[#03050e]" />,
});

/** Letterbox bars — squeeze in while the debate is live (movie feel). */
function Letterbox() {
  const phase = useArenaStore((s) => s.phase);
  const on = ["speaking", "transition", "intermission", "referee_enter", "verdict", "verdict_generating", "gavel"].includes(phase);
  return (
    <>
      <motion.div
        animate={{ height: on ? "4.2vh" : 0 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-black"
      />
      <motion.div
        animate={{ height: on ? "4.2vh" : 0 }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-black"
      />
    </>
  );
}

/** RESUME card shown after a page reload (explicit gesture → safe audio). */
function ResumeCard({ onStart }: { onStart: () => void }) {
  const { t } = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-40 grid place-items-center bg-slate-950/70 backdrop-blur-sm"
    >
      <div className="glass-panel flex flex-col items-center gap-5 px-10 py-8 text-center">
        <div className="text-4xl">🎬</div>
        <div className="text-sm uppercase tracking-[0.35em] text-cyan-200/90">{t("tagline")}</div>
        <button
          onClick={onStart}
          className="rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 px-8 py-3.5 text-sm font-black uppercase tracking-[0.25em] text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.45)] transition hover:scale-105"
        >
          ▶️ {t("resume")}
        </button>
      </div>
    </motion.div>
  );
}

/* StrictMode-safe teardown bookkeeping (module scope). */
let mountToken = 0;

export default function ArenaPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [needResume, setNeedResume] = useState(false);
  const [authWall, setAuthWall] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const started = useRef(false);
  const cfgRef = useRef<DebateConfig | null>(null);
  const { t } = useT();
  const { status: sessionStatus } = useSession();

  /* boot the show exactly once per real mount */
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Debug/E2E bridge: expose show state for automated testing tools
    const unsub = useArenaStore.subscribe((s) => {
      const w = window as unknown as Record<string, unknown>;
      w.__arenaPhase = s.phase;
      w.__arenaRound = s.round;
      w.__arenaSpeaker = s.performance?.speaker ?? null;
      w.__arenaTurn = s.turnIndex;
    });

    let cfg: DebateConfig | null = null;
    try {
      const raw = sessionStorage.getItem("arena-config");
      if (raw) cfg = JSON.parse(raw) as DebateConfig;
    } catch { /* ignore */ }
    cfgRef.current = cfg;

    if (!cfg || !cfg.topic) {
      unsub();
      router.replace("/");
      return;
    }
    setReady(true);

    // A RELOAD must not auto-start: show the resume card instead (the click
    // also satisfies autoplay policies). Normal SPA navigation auto-starts.
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === "reload") {
      setNeedResume(true);
    } else {
      void bootWithQuota(cfg);
    }
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  /** Quota gate: spend one weekly debate BEFORE the show boots.
   *  401 → guest sign-in wall · 402 → pricing wall · 429 → error card. */
  async function bootWithQuota(cfg: DebateConfig) {
    if (sessionStorage.getItem("arena-consumed") !== "1") {
      try {
        const r = await fetch("/api/quota", { method: "POST", headers: { "x-guest-token": guestToken() } });
        if (r.status === 401) { setAuthWall(true); return; }
        if (r.status === 402) { setPricingOpen(true); return; }
        if (!r.ok) {
          const b = (await r.json().catch(() => ({}))) as { error?: string };
          useArenaStore.getState().fail(b.error || "Quota service unavailable");
          return;
        }
        sessionStorage.setItem("arena-consumed", "1");
      } catch {
        /* network hiccup → fail open so the show never bricks */
      }
    }
    void director.start(cfg);
  }

  /* after signing in from the wall: retry the boot automatically */
  useEffect(() => {
    if (authWall && sessionStatus === "authenticated" && cfgRef.current) {
      setAuthWall(false);
      void bootWithQuota(cfgRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authWall, sessionStatus]);

  /* teardown that survives StrictMode: defer by a tick; a remount cancels it */
  useEffect(() => {
    const my = ++mountToken;
    return () => {
      setTimeout(() => {
        if (mountToken === my) {
          director.stop();
          audioBus.stop();
          score.stop();
        }
      }, 60);
    };
  }, []);

  /* keyboard shortcuts: Space=pause, Esc=exit, D=dance (victory) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useArenaStore.getState();
      if (e.code === "Space") {
        e.preventDefault();
        director.togglePause();
      } else if (e.code === "Escape") {
        director.stop();
        router.push("/");
      } else if (e.key.toLowerCase() === "d" && s.phase === "victory") {
        const next = !s.danceMode;
        s.setDanceMode(next);
        score.setDance(next);
      }
    };
    window.addEventListener("keydown", onKey);

    /* Autoplay-policy insurance: the first click/keypress anywhere unlocks
       the AudioContext and lets blocked playback retry (see AudioBus). */
    const unlock = () => {
      const ctx = audioBus.init();
      if (ctx.state === "suspended") void ctx.resume();
      audioBus.notifyGesture();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [router]);

  const startNow = () => {
    setNeedResume(false);
    if (cfgRef.current) void bootWithQuota(cfgRef.current);
  };

  return (
    <main className="scanlines relative h-dvh w-full overflow-hidden bg-[#03050e]">
      {ready && <ArenaCanvas />}

      {/* subtle arena vignette at all times */}
      <div className="pointer-events-none absolute inset-0 z-10"
        style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(1,3,10,0.55) 100%)" }} />

      <Letterbox />
      <HUD />
      <ControlBar />
      <Overlays />
      {needResume && <ResumeCard onStart={startNow} />}
      <AuthModal open={authWall} onClose={() => setAuthWall(false)} reason="wall" />
      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} />

      {/* corner branding */}
      <div className="pointer-events-none absolute bottom-[6.5vh] right-3 z-20 hidden text-[9px] uppercase tracking-[0.35em] text-slate-600 sm:block rtl:right-auto rtl:left-3">
        AI Debate Arena · {t("tagline")}
      </div>
    </main>
  );
}
