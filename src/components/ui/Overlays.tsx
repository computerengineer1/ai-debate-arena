/**
 * Overlays — generating / intermission vignette / referee title card /
 * error / VICTORY screen (icon-based verdict summary + easter eggs).
 * Speech text is never rendered anywhere (voice-only contract).
 */
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useArenaStore } from "@/store/useArenaStore";
import { director } from "@/lib/client/director";
import { score } from "@/lib/client/music";
import { useT } from "@/lib/client/useT";
import type { VerdictScores } from "@/lib/types";

/* ─────────────── generating ─────────────── */

function GeneratingOverlay() {
  const phase = useArenaStore((s) => s.phase);
  const { t } = useT();
  const show = phase === "generating";
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 grid place-items-center bg-slate-950/80 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-5">
            <div className="relative h-20 w-20">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-cyan-400 border-r-fuchsia-500/60" />
              <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-amber-400 [animation-direction:reverse] [animation-duration:1.6s]" />
              <div className="absolute inset-0 grid place-items-center text-2xl">🧠</div>
            </div>
            <div className="text-sm uppercase tracking-[0.4em] text-cyan-200/90">{t("generating")}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────── intermission vignette ─────────────── */

function IntermissionVignette() {
  const phase = useArenaStore((s) => s.phase);
  const on = phase === "intermission" || phase === "referee_enter";
  return (
    <motion.div
      animate={{ opacity: on ? 1 : 0 }}
      transition={{ duration: 1.1 }}
      className="pointer-events-none absolute inset-0 z-20"
      style={{ background: "radial-gradient(ellipse at center, transparent 22%, rgba(0,0,0,0.82) 78%)" }}
    />
  );
}

/* ─────────────── referee title card ─────────────── */

function RefereeCard() {
  const phase = useArenaStore((s) => s.phase);
  const { t } = useT();
  return (
    <AnimatePresence>
      {(phase === "referee_enter" || phase === "verdict_generating") && (
        <motion.div
          initial={{ opacity: 0, scale: 1.4, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="pointer-events-none absolute inset-x-0 top-1/3 z-30 flex flex-col items-center"
        >
          <div className="text-5xl">⚖️</div>
          <div className="mt-3 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-4xl font-black tracking-[0.3em] text-transparent drop-shadow-[0_0_25px_rgba(251,191,36,0.45)] md:text-6xl">
            {t("referee_coming")}
          </div>
          {phase === "verdict_generating" && (
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="mt-4 text-xs uppercase tracking-[0.5em] text-amber-300/80"
            >
              {t("deliberating")}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────── error ─────────────── */

function ErrorOverlay() {
  const phase = useArenaStore((s) => s.phase);
  const error = useArenaStore((s) => s.error);
  const config = useArenaStore((s) => s.config);
  const { t } = useT();
  const router = useRouter();
  if (phase !== "error") return null;
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/85 p-6 backdrop-blur">
      <div className="max-w-md rounded-2xl border border-rose-500/30 bg-slate-900/80 p-8 text-center">
        <div className="text-4xl">💥</div>
        <h2 className="mt-3 text-lg font-bold text-rose-300">{t("error")}</h2>
        <p className="mt-2 break-words font-mono text-[11px] leading-relaxed text-slate-400">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => config && director.start(config, { rematch: true })}
            className="rounded-xl bg-cyan-500/90 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
          >
            {t("retry")}
          </button>
          <button
            onClick={() => { director.stop(); router.push("/"); }}
            className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800"
          >
            {t("back_home")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── victory screen ─────────────── */

const AXES: { key: keyof VerdictScores; icon: string; labelKey: "logic" | "evidence_score" | "rhetoric" | "rebuttal" | "emotion" }[] = [
  { key: "logic", icon: "🧠", labelKey: "logic" },
  { key: "evidence", icon: "📚", labelKey: "evidence_score" },
  { key: "rhetoric", icon: "🎙️", labelKey: "rhetoric" },
  { key: "rebuttal", icon: "⚔️", labelKey: "rebuttal" },
  { key: "emotional_impact", icon: "❤️‍🔥", labelKey: "emotion" },
];

function ScoreRow({ icon, label, logos, pathos }: { icon: string; label: string; logos: number; pathos: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 text-center text-sm">{icon}</span>
      <div className="flex h-2 w-16 flex-row-reverse overflow-hidden rounded-full bg-slate-800 sm:w-24 md:w-28">
        <motion.div initial={{ width: 0 }} animate={{ width: `${logos * 10}%` }} transition={{ duration: 0.8, delay: 0.3 }} className="h-full bg-sky-400" />
      </div>
      <span className="w-9 text-center text-[8px] uppercase tracking-wider text-slate-400 sm:w-10 sm:text-[9px]">{label}</span>
      <div className="flex h-2 w-16 overflow-hidden rounded-full bg-slate-800 sm:w-24 md:w-28">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pathos * 10}%` }} transition={{ duration: 0.8, delay: 0.3 }} className="h-full bg-rose-400" />
      </div>
    </div>
  );
}

function VictoryOverlay() {
  const phase = useArenaStore((s) => s.phase);
  const config = useArenaStore((s) => s.config);
  const [copied, setCopied] = useState(false);
  const verdict = useArenaStore((s) => s.verdict);
  const danceMode = useArenaStore((s) => s.danceMode);
  const revealed = useArenaStore((s) => s.winnerRevealed);
  const { t } = useT();
  const router = useRouter();
  const [konami, setKonami] = useState(0);

  const share = async () => {
    const winner = verdict?.winner === "pathos" ? "PATHOS" : "LOGOS";
    const text = `🤖⚔️ ${winner} won a 4-round cinematic AI debate on "${config?.topic ?? "AI"}" — real voices, zero subtitles. Try it free:`;
    const url = typeof location !== "undefined" ? location.origin : "";
    try {
      if (navigator.share) await navigator.share({ text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch { /* user cancelled */ }
  };

  /* Easter egg #1: Konami code → dance mode */
  useEffect(() => {
    const seq = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    const onKey = (e: KeyboardEvent) => {
      setKonami((k) => {
        const next = e.key === seq[k] ? k + 1 : 0;
        if (next === seq.length) {
          useArenaStore.getState().setDanceMode(true);
          score.setDance(true);
          return 0;
        }
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const show = phase === "victory" && revealed && verdict;
  const winner = verdict?.winner;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-between py-4 sm:py-8"
        >
          {/* winner banner */}
          <motion.div
            initial={{ y: -60, opacity: 0, scale: 0.7 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 160, damping: 14, delay: 0.6 }}
            className="flex flex-col items-center"
          >
            <div className="text-[10px] uppercase tracking-[0.6em] text-slate-400">🏆 {t("winner")} 🏆</div>
            <div
              className={`mt-1 text-4xl font-black tracking-[0.15em] drop-shadow-[0_0_30px_currentColor] sm:text-5xl sm:tracking-[0.2em] md:text-7xl ${winner === "logos" ? "text-sky-400" : "text-rose-400"}`}
            >
              {winner === "logos" ? "LOGOS" : "PATHOS"}
            </div>
          </motion.div>

          {/* icon-based verdict summary panel */}
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 1.1 }}
            className="pointer-events-auto flex flex-col items-center gap-4"
          >
            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/75 px-3 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
              <div className="mb-2 flex items-center justify-between text-[10px] font-bold tracking-[0.25em]">
                <span className="w-28 text-sky-400">LOGOS</span>
                <span className="text-amber-300/90">⚖️ {t("verdict_of")}</span>
                <span className="w-28 text-right text-rose-400">PATHOS</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {AXES.map(({ key, icon, labelKey }) => (
                  <ScoreRow
                    key={key}
                    icon={icon}
                    label={t(labelKey)}
                    logos={verdict!.scores.logos[key]}
                    pathos={verdict!.scores.pathos[key]}
                  />
                ))}
              </div>
              {verdict!.key_moment && (
                <div className="mt-3 max-w-[300px] border-t border-slate-800 pt-2 text-center text-[10px] italic text-amber-200/80 sm:max-w-none sm:text-[11px]">
                  ✦ {verdict!.key_moment} ✦
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => void share()}
                className="rounded-xl border border-slate-600 bg-slate-900/70 px-5 py-2.5 text-sm font-bold text-slate-200 backdrop-blur transition hover:scale-105 hover:border-cyan-400/60"
              >
                {copied ? `✓ ${t("copied")}` : `📣 ${t("share")}`}
              </button>
              <button
                onClick={() => {
                  const next = !useArenaStore.getState().danceMode;
                  useArenaStore.getState().setDanceMode(next);
                  score.setDance(next);
                }}
                className={`rounded-xl border px-5 py-2.5 text-sm font-bold backdrop-blur transition hover:scale-105 ${
                  danceMode
                    ? "border-fuchsia-400/70 bg-fuchsia-500/25 text-fuchsia-200 shadow-[0_0_20px_#d946ef66]"
                    : "border-slate-600 bg-slate-900/70 text-slate-300"
                }`}
                title="↑↑↓↓←→←→BA"
              >
                🕺 {t("dance")}
              </button>
              <button
                onClick={() => director.restart()}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-6 py-2.5 text-sm font-black tracking-wider text-slate-950 shadow-[0_0_24px_#22d3ee66] transition hover:scale-105"
              >
                ⚔️ {t("debate_again")}
              </button>
              <button
                onClick={() => { director.stop(); router.push("/"); }}
                className="rounded-xl border border-slate-600 bg-slate-900/70 px-5 py-2.5 text-sm text-slate-300 backdrop-blur transition hover:bg-slate-800"
              >
                {t("back_home")}
              </button>
            </div>
            <div className="text-[9px] uppercase tracking-[0.3em] text-slate-600">↑↑↓↓←→←→BA</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────── paused badge ─────────────── */

function PausedBadge() {
  const paused = useArenaStore((s) => s.paused);
  return (
    <AnimatePresence>
      {paused && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-30 grid place-items-center"
        >
          <div className="rounded-2xl border border-cyan-400/30 bg-slate-950/70 px-10 py-6 text-3xl tracking-[0.4em] text-cyan-200 backdrop-blur">
            ⏸ PAUSED
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Overlays() {
  return (
    <>
      <GeneratingOverlay />
      <IntermissionVignette />
      <RefereeCard />
      <ErrorOverlay />
      <VictoryOverlay />
      <PausedBadge />
    </>
  );
}
