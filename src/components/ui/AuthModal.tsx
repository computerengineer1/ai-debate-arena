/**
 * AuthModal — sign in with Google / GitHub / Discord (whatever is
 * configured server-side). Shown as a cinematic glass sheet.
 */
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/client/useT";

const BRAND: Record<string, { label: string; icon: React.ReactNode; bg: string }> = {
  google: {
    label: "Google",
    bg: "bg-white text-slate-900 hover:bg-slate-100",
    icon: (
      <svg width="16" height="16" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z"/>
      </svg>
    ),
  },
  github: {
    label: "GitHub",
    bg: "bg-slate-900 text-white hover:bg-slate-800 border border-slate-700",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
      </svg>
    ),
  },
  discord: {
    label: "Discord",
    bg: "bg-[#5865F2] text-white hover:bg-[#4752c4]",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.3 4.4A19.8 19.8 0 0 0 15.9 3l-.2.4c1.6.4 2.4 1 3.2 1.7A13.4 13.4 0 0 0 12 3.8c-2.8 0-4.9.7-6.9 1.3.8-.7 1.7-1.4 3.2-1.7L8.1 3a19.8 19.8 0 0 0-4.4 1.4C2 8 1.5 11.6 1.8 15.1c1.7 1.3 3.4 2 5 2.5l.8-1.3c-.9-.3-1.7-.8-2.5-1.5 2.1 1 4.4 1.5 6.9 1.5s4.8-.5 6.9-1.5c-.8.7-1.6 1.2-2.5 1.5l.8 1.3c1.6-.5 3.3-1.2 5-2.5.4-4-.6-7.6-2.9-10.7zM8.7 13.9c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/>
      </svg>
    ),
  },
};

export default function AuthModal({ open, onClose, reason }: { open: boolean; onClose: () => void; reason?: "wall" | null }) {
  const { t } = useT();
  const [available, setAvailable] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((p: Record<string, { id: string }>) => setAvailable(Object.values(p).map((x) => x.id)))
      .catch(() => setAvailable([]));
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
            className="glass-panel w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-3xl">🎭</div>
              <h2 className="mt-2 text-lg font-black tracking-[0.15em] text-cyan-200">{t("sign_in")}</h2>
              {reason === "wall" && (
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{t("guest_wall_body")}</p>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              {available.length === 0 && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-center text-[11px] leading-relaxed text-amber-300">
                  {t("auth_not_configured")}
                </p>
              )}
              {available.map((id) => {
                const b = BRAND[id] ?? { label: id, bg: "bg-slate-800 text-white", icon: null };
                return (
                  <button
                    key={id}
                    onClick={() => signIn(id, { callbackUrl: window.location.pathname + window.location.search })}
                    className={`flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-bold transition ${b.bg}`}
                  >
                    {b.icon}
                    {t("continue_with")} {b.label}
                  </button>
                );
              })}
            </div>

            <button onClick={onClose} className="mt-4 w-full text-center text-[11px] text-slate-500 hover:text-slate-300">
              ✕ {t("stop")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
