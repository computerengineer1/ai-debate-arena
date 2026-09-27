/**
 * PricingModal — the 3 plans wall (shown when the weekly limit is hit).
 * Checkout runs on Lemon Squeezy: cards (Visa/Mastercard/…) are processed
 * there; our webhook grants the plan. We never touch card data.
 */
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useT } from "@/lib/client/useT";

interface PlanView {
  id: string; name: string; tagline: string; priceMonthly: number;
  debatesPerWeek: number; ads: boolean; perks: string[]; checkoutUrl: string;
}

export default function PricingModal({ open, onClose, currentPlan }: { open: boolean; onClose: () => void; currentPlan?: string }) {
  const { t } = useT();
  const [plans, setPlans] = useState<PlanView[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/billing/plans").then((r) => r.json()).then((j) => setPlans(j.plans ?? [])).catch(() => undefined);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
            className="w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 text-center">
              <div className="text-3xl">👑</div>
              <h2 className="mt-1 text-xl font-black tracking-[0.2em] text-amber-300">{t("quota_wall_title")}</h2>
              <p className="mt-1.5 text-xs text-slate-400">{t("quota_wall_body")}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {plans.map((p) => {
                const hot = p.id === "orator";
                const current = currentPlan === p.id;
                return (
                  <motion.div
                    key={p.id}
                    whileHover={{ y: -4 }}
                    className={`relative flex flex-col rounded-2xl border p-4 backdrop-blur-xl ${
                      hot
                        ? "border-cyan-400/60 bg-cyan-950/40 shadow-[0_0_35px_rgba(34,211,238,0.25)]"
                        : "border-slate-700/60 bg-slate-950/70"
                    }`}
                  >
                    {hot && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 px-3 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-950">
                        {t("most_popular")}
                      </span>
                    )}
                    <div className="text-sm font-black tracking-[0.2em]" style={{ color: hot ? "#67e8f9" : p.id === "legend" ? "#fbbf24" : "#94a3b8" }}>
                      {p.name.toUpperCase()}
                    </div>
                    <div className="text-[10px] italic text-slate-500">{p.tagline}</div>
                    <div className="mt-3 flex items-end gap-1">
                      <span className="text-3xl font-black text-white">${p.priceMonthly}</span>
                      <span className="pb-1 text-[10px] text-slate-500">/{t("per_month")}</span>
                    </div>
                    <ul className="mt-3 flex flex-1 flex-col gap-1.5">
                      {p.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300">
                          <span className="text-emerald-400">✓</span> {perk}
                        </li>
                      ))}
                    </ul>
                    <button
                      disabled={p.priceMonthly === 0 || current || !p.checkoutUrl}
                      onClick={() => window.open(p.checkoutUrl, "_blank", "noopener")}
                      className={`mt-4 rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-wider transition ${
                        current
                          ? "cursor-default border border-slate-700 text-slate-500"
                          : p.priceMonthly === 0
                            ? "cursor-default border border-slate-700 text-slate-500"
                            : !p.checkoutUrl
                              ? "cursor-wait border border-amber-600/40 text-amber-400/80"
                              : hot
                                ? "bg-gradient-to-r from-cyan-400 to-sky-500 text-slate-950 hover:scale-[1.03]"
                                : "border border-amber-400/50 text-amber-300 hover:bg-amber-500/10"
                      }`}
                      title={!p.checkoutUrl && p.priceMonthly > 0 ? t("payment_setup_pending") : undefined}
                    >
                      {current ? t("current_plan") : p.priceMonthly === 0 ? t("current_plan") : !p.checkoutUrl ? t("payment_setup_pending") : t("upgrade")}
                    </button>
                  </motion.div>
                );
              })}
            </div>

            <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-500">
              🔒 {t("payment_security_note")}
            </p>
            <button onClick={onClose} className="mx-auto mt-2 block text-[11px] text-slate-500 hover:text-slate-300">✕ {t("stop")}</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
