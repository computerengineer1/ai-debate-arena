/**
 * LanguagePicker — flag + native-name dropdown with smooth animation.
 */
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { LANGUAGES } from "@/lib/languages";
import { useLangStore } from "@/store/useLangStore";
import { useT } from "@/lib/client/useT";

export default function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const { t } = useT();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <div className="relative">
      {!compact && (
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.25em] text-slate-400">{t("language")}</div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-slate-900/70 px-3.5 py-2.5 text-sm text-cyan-100 backdrop-blur transition hover:border-cyan-300/60 hover:bg-slate-800/80"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-lg leading-none">{current.flag}</span>
        <span className="font-medium">{current.nativeName}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" className={`opacity-60 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute z-50 mt-2 grid max-h-72 w-56 grid-cols-1 gap-0.5 overflow-y-auto rounded-xl border border-cyan-400/20 bg-slate-950/95 p-1.5 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl"
            role="listbox"
          >
            {LANGUAGES.map((l) => (
              <li key={l.code}>
                <button
                  role="option"
                  aria-selected={l.code === lang}
                  onClick={() => { setLang(l.code); setOpen(false); }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    l.code === lang
                      ? "bg-cyan-500/20 text-cyan-200"
                      : "text-slate-300 hover:bg-slate-800/80"
                  }`}
                >
                  <span className="text-base">{l.flag}</span>
                  <span className="flex-1 text-start">{l.nativeName}</span>
                  <span className="text-[10px] text-slate-500">{l.name}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
