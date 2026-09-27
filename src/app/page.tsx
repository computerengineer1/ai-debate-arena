/**
 * Landing page — cinematic hero: particle field + live 3D turntable of
 * the three AI characters + debate setup console (topic, stances,
 * language) and the epic ENTER THE ARENA button.
 */
"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ParticlesBg from "@/components/ui/ParticlesBg";
import RippleButton from "@/components/ui/RippleButton";
import LanguagePicker from "@/components/ui/LanguagePicker";
import { useT } from "@/lib/client/useT";
import { useLangStore } from "@/store/useLangStore";
import { useQuota } from "@/lib/client/useQuota";
import ProfileMenu from "@/components/ui/ProfileMenu";
import AuthModal from "@/components/ui/AuthModal";
import PricingModal from "@/components/ui/PricingModal";
import AdSlot from "@/components/ui/AdSlot";
import type { DebateConfig } from "@/lib/types";

const LandingPreview = dynamic(() => import("@/components/three/LandingPreview"), { ssr: false });

const PRESETS: { topic: string; logos: string; pathos: string }[] = [
  { topic: "Artificial intelligence will replace human creativity", logos: "AI amplifies and democratizes human creativity", pathos: "AI hollows out the human soul of art" },
  { topic: "Social media connects us more than it isolates us", logos: "The data shows net gains in human connection", pathos: "We have never been more lonely than now" },
  { topic: "Remote work is superior to office work", logos: "Distributed work outperforms on every measurable axis", pathos: "The office is where culture, mentorship and belonging live" },
  { topic: "Humanity should prioritize space exploration over fixing Earth", logos: "Space investment pays for Earth a thousand-fold", pathos: "It is immoral to flee a house we ourselves set on fire" },
  { topic: "Esports are real sports", logos: "By every scientific definition, esports qualify as sport", pathos: "Sport is sweat, soil and flesh — not pixels" },
];

const CHARACTERS = [
  { id: "logos", name: "LOGOS", icon: "🧊", hue: "#38bdf8", traits: ["Rational", "Data-driven", "Soft-spoken, razor sharp"] },
  { id: "referee", name: "REFEREE", icon: "⚖️", hue: "#fbbf24", traits: ["Neutral", "Wise", "Judges 5 dimensions"] },
  { id: "pathos", name: "PATHOS", icon: "🔥", hue: "#fb7185", traits: ["Passionate", "Storyteller", "Dramatic orator"] },
];

export default function LandingPage() {
  const router = useRouter();
  const { t } = useT();
  const lang = useLangStore((s) => s.lang);
  const [mounted, setMounted] = useState(false);
  const [topic, setTopic] = useState("");
  const [logosStance, setLogos] = useState("");
  const [pathosStance, setPathos] = useState("");
  const [focus, setFocus] = useState(1); // referee in the middle of the turntable
  const { quota } = useQuota();
  const [authOpen, setAuthOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const randomize = () => {
    const p = PRESETS[Math.floor(Math.random() * PRESETS.length)];
    setTopic(p.topic);
    setLogos(p.logos);
    setPathos(p.pathos);
  };

  const enter = () => {
    const cfg: DebateConfig = {
      topic: topic.trim() || PRESETS[0].topic,
      logosStance: logosStance.trim() || `In favor of: ${topic.trim() || PRESETS[0].topic}`,
      pathosStance: pathosStance.trim() || `Against: ${topic.trim() || PRESETS[0].topic}`,
      language: lang,
    };
    sessionStorage.setItem("arena-config", JSON.stringify(cfg));
    sessionStorage.removeItem("arena-consumed"); // fresh debate → fresh quota spend
    router.push("/arena");
  };

  const canStart = topic.trim().length >= 3;

  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* background layers */}
      <ParticlesBg />
      <div className="absolute inset-0 opacity-90">
        {mounted && <LandingPreview focus={focus} />}
      </div>
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 40%, transparent 30%, rgba(3,5,14,0.55) 85%)" }} />

      {/* content */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-8">
        {/* header */}
        <motion.header
          initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
          className="flex items-start justify-between"
        >
          <div>
            <h1 className="title-flicker text-[26px] font-black leading-tight tracking-[0.12em] text-transparent sm:text-4xl sm:tracking-[0.18em] md:text-6xl"
              style={{ backgroundImage: "linear-gradient(100deg,#67e8f9,#38bdf8 35%,#a78bfa 70%,#fbbf24)", WebkitBackgroundClip: "text", backgroundClip: "text" }}>
              <span className="text-glow-cyan">AI DEBATE ARENA</span>
            </h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-cyan-200/70 sm:text-xs sm:tracking-[0.55em] md:text-sm">{t("tagline")}</p>
          </div>
          <div className="flex items-center gap-2.5">
            {quota && quota.limit >= 0 && (
              <span className="hidden rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-[10px] font-bold text-cyan-300 sm:block" title={t("debates_left")}>
                ⚡ {quota.left}/{quota.limit}
              </span>
            )}
            <LanguagePicker />
            <ProfileMenu quota={quota} onSignIn={() => setAuthOpen(true)} />
          </div>
        </motion.header>

        {/* middle: setup console (glass card) */}
        <div className="flex flex-1 items-center py-6 sm:py-8">
          <motion.div
            initial={{ opacity: 0, x: -36 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.25 }}
            className="glass-panel w-full max-w-md p-4 shadow-[0_0_60px_rgba(8,145,178,0.15)] sm:p-6"
          >
            <p className="mb-5 text-[11px] leading-relaxed text-slate-400">{t("landing_subtitle")}</p>

            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-300/90">{t("topic")}</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t("topic_ph")}
              rows={2}
              className="mb-1.5 w-full resize-none rounded-xl border border-slate-700/60 bg-slate-900/70 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-cyan-400/70 focus:shadow-[0_0_18px_rgba(34,211,238,0.18)]"
            />
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <button onClick={randomize} className="rounded-full border border-slate-700/70 px-2.5 py-1 text-[10px] text-slate-400 transition hover:border-fuchsia-400/60 hover:text-fuchsia-300">
                🎲 {t("random")}
              </button>
              {PRESETS.slice(0, 3).map((p, i) => (
                <button key={i} onClick={() => { setTopic(p.topic); setLogos(p.logos); setPathos(p.pathos); }}
                  className="max-w-[110px] truncate rounded-full border border-slate-800 bg-slate-900/50 px-2.5 py-1 text-[10px] text-slate-500 transition hover:border-cyan-400/50 hover:text-cyan-200"
                  title={p.topic}>
                  {p.topic}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-xl border border-sky-500/25 bg-sky-950/25 p-3">
                <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">
                  🧊 {t("logos_stance")}
                </label>
                <input value={logosStance} onChange={(e) => setLogos(e.target.value)} placeholder={t("logos_stance_ph")}
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-sky-400/60" />
              </div>
              <div className="rounded-xl border border-rose-500/25 bg-rose-950/25 p-3">
                <label className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">
                  🔥 {t("pathos_stance")}
                </label>
                <input value={pathosStance} onChange={(e) => setPathos(e.target.value)} placeholder={t("pathos_stance_ph")}
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-rose-400/60" />
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <RippleButton onClick={enter} disabled={!canStart}>
                ⚔️ {t("enter_arena")}
              </RippleButton>
            </div>
            {!canStart && <p className="mt-2 text-center text-[10px] text-slate-500">↑ {t("topic")}</p>}
          </motion.div>
        </div>

        {/* footer: character strip */}
        <motion.footer
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.45 }}
          className="flex flex-wrap items-end justify-center gap-3 md:justify-between"
        >
          {CHARACTERS.map((c, i) => (
            <button key={c.id} onClick={() => setFocus(i === 0 ? 0 : i === 2 ? 2 : 1)}
              className="glass-panel group flex w-full max-w-[280px] items-center gap-3 p-3 text-start transition hover:-translate-y-1 sm:w-60 sm:p-3.5"
              style={{ borderColor: `${c.hue}44` }}>
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full"
                style={{ boxShadow: `0 0 18px ${c.hue}66, inset 0 0 0 1px ${c.hue}88` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/characters/${c.id}.png`} alt={c.name} className="h-full w-full object-cover object-top" />
              </span>
              <span>
                <span className="block text-sm font-black tracking-[0.2em]" style={{ color: c.hue }}>{c.name}</span>
                <span className="mt-0.5 block text-[10px] leading-snug text-slate-500 group-hover:text-slate-400">
                  {c.traits.join(" · ")}
                </span>
              </span>
            </button>
          ))}
          <p className="hidden w-full text-center text-[9px] uppercase tracking-[0.4em] text-slate-700 md:w-auto md:pb-2">
            {t("voice_only")} · 16 languages · 4 rounds · 1 verdict
          </p>
        </motion.footer>

        {/* professional ad slot — never inside the debate itself */}
        <div className="pb-6 pt-2">
          <AdSlot zone="landing" showAds={(quota?.plan ?? "free") === "free"} onUpgrade={() => setPricingOpen(true)} />
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
        <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} currentPlan={quota?.plan} />
      </div>
    </main>
  );
}
