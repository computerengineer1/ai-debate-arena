/**
 * HUD — subtle in-arena interface: round pips, emotion meters,
 * speaker plates, debate timer. Icons + meters only, NEVER speech text.
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useArenaStore } from "@/store/useArenaStore";
import { useT } from "@/lib/client/useT";
import type { Emotion, Speaker } from "@/lib/types";

const EMOTION_EMOJI: Record<Emotion, string> = {
  calm: "🧘", thinking: "🤔", confident: "😌", amused: "😏", firm: "🗿",
  passionate: "🔥", angry: "😠", sarcastic: "😒", frustrated: "😤", victorious: "🏆",
};

const ROUND_KEYS = ["opening", "evidence", "rebuttals", "closing"] as const;

function fmt(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function SpeakerPlate({ who, side }: { who: Speaker; side: "left" | "right" }) {
  const perf = useArenaStore((s) => s.performance);
  const phase = useArenaStore((s) => s.phase);
  const verdict = useArenaStore((s) => s.verdict);
  const active = (phase === "speaking" && perf?.speaker === who) || (phase === "victory" && verdict?.winner === who);
  const myPerf = active ? perf : null;
  const isRefWin = phase === "victory" && verdict?.winner === who;

  const color = who === "logos" ? "#38bdf8" : "#fb7185";
  const name = who === "logos" ? "LOGOS" : "PATHOS";
  const subtitle = who === "logos" ? "THE RATIONAL" : "THE ORATOR";

  return (
    <motion.div
      animate={{ opacity: active ? 1 : 0.45, scale: active ? 1 : 0.96 }}
      transition={{ duration: 0.35 }}
      className={`flex items-center gap-2 rounded-2xl border bg-slate-950/55 px-2.5 py-2 backdrop-blur-md sm:gap-3 sm:px-4 sm:py-2.5 ${side === "right" ? "flex-row-reverse" : ""}`}
      style={{ borderColor: active ? `${color}66` : "#33415533", boxShadow: active ? `0 0 24px ${color}33` : "none" }}
    >
      {/* avatar sigil */}
      <div
        className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full sm:h-9 sm:w-9"
        style={{ background: `radial-gradient(circle at 35% 30%, ${color}, #0f172a 75%)`, boxShadow: active ? `0 0 14px ${color}` : "none" }}
      >
        {active && <span className="absolute inset-0 animate-ping rounded-full" style={{ background: `${color}22` }} />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/characters/${who}.png`} alt={name} className="h-full w-full rounded-full object-cover object-top" />
      </div>

      <div className={side === "right" ? "text-right" : ""}>
        <div className="text-[10px] font-bold tracking-[0.15em] sm:text-[13px] sm:tracking-[0.2em]" style={{ color }}>{name}</div>
        <div className="hidden text-[9px] uppercase tracking-[0.3em] text-slate-500 sm:block">{subtitle}</div>
        {/* emotion meter */}
        <div className={`mt-1.5 flex items-center gap-1.5 ${side === "right" ? "flex-row-reverse" : ""}`}>
          <AnimatePresence mode="wait">
            {(myPerf || isRefWin) && (
              <motion.span
                key={myPerf?.emotion ?? "win"}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="text-sm"
              >
                {isRefWin ? "🏆" : EMOTION_EMOJI[myPerf!.emotion]}
              </motion.span>
            )}
          </AnimatePresence>
          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-800/90 sm:w-24">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${color}, ${myPerf?.intensity && myPerf.intensity > 0.75 ? "#f87171" : color})` }}
              animate={{ width: myPerf ? `${Math.round((myPerf.intensity ?? 0.4) * 100)}%` : "8%" }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function HUD() {
  const round = useArenaStore((s) => s.round);
  const phase = useArenaStore((s) => s.phase);
  const elapsed = useArenaStore((s) => s.elapsedSec);
  const refereePresent = useArenaStore((s) => s.refereePresent);
  const fallback = useArenaStore((s) => s.ttsFallback);
  const { t } = useT();

  const showRounds = !refereePresent && round >= 1 && round <= 4;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      {/* ── top center: round pips ── */}
      <div className="absolute left-1/2 top-14 -translate-x-1/2 sm:top-4">
        <AnimatePresence mode="wait">
          {showRounds ? (
            <motion.div
              key="rounds"
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              className="flex flex-col items-center gap-1.5"
            >
              <div className="flex items-center gap-2">
                {ROUND_KEYS.map((k, i) => {
                  const n = i + 1;
                  const done = n < round;
                  const now = n === round;
                  return (
                    <div key={k} className="flex flex-col items-center gap-1">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${done ? "w-5 bg-cyan-400/70 sm:w-8" : now ? "w-8 bg-cyan-300 shadow-[0_0_12px_#22d3ee] sm:w-12" : "w-5 bg-slate-700/80 sm:w-8"}`}
                      />
                      <span className={`hidden text-[8px] uppercase tracking-[0.2em] sm:block ${now ? "text-cyan-200" : "text-slate-600"}`}>
                        {t("round")} {n}
                      </span>
                    </div>
                  );
                })}
              </div>
              <motion.span
                key={round}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[9px] font-medium uppercase tracking-[0.25em] text-cyan-100/80 sm:text-[10px] sm:tracking-[0.45em]"
              >
                {t(ROUND_KEYS[round - 1])}
              </motion.span>
            </motion.div>
          ) : (
            <motion.div
              key="ref"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-950/30 px-4 py-1.5 backdrop-blur"
            >
              <span className="text-sm">⚖️</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.4em] text-amber-300">
                {t("referee_coming")}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── speaker plates ── */}
      <div className="absolute left-2 top-2 rtl:left-auto rtl:right-2 sm:left-4 sm:top-4 sm:rtl:left-auto sm:rtl:right-4">
        <SpeakerPlate who="logos" side="left" />
      </div>
      <div className="absolute right-2 top-2 rtl:right-auto rtl:left-2 sm:right-4 sm:top-4 sm:rtl:right-auto sm:rtl:left-4">
        <SpeakerPlate who="pathos" side="right" />
      </div>

      {/* ── bottom-left: timer + voice-only badge ── */}
      <div className="absolute bottom-24 left-2 flex flex-col gap-1.5 rtl:left-auto rtl:right-2 sm:bottom-20 sm:left-4 sm:rtl:left-auto sm:rtl:right-4">
        <div className="rounded-lg border border-slate-700/50 bg-slate-950/60 px-2.5 py-1 font-mono text-[11px] text-slate-400 backdrop-blur">
          ⏱ {fmt(elapsed)}
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-800/60 bg-slate-950/50 px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] text-slate-500 backdrop-blur">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {t("voice_only")}
        </div>
        {fallback && (
          <div className="rounded-lg border border-amber-600/40 bg-amber-950/40 px-2.5 py-1 text-[9px] uppercase tracking-wider text-amber-400">
            ⚠ browser voice fallback
          </div>
        )}
      </div>
    </div>
  );
}
