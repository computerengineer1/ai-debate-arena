/**
 * ProfileMenu — header identity: sign-in button or avatar dropdown
 * (profile, plan badge, usage, sign out).
 */
"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useT } from "@/lib/client/useT";
import type { QuotaView } from "@/lib/client/useQuota";

const PLAN_STYLE: Record<string, string> = {
  free: "text-slate-400 border-slate-600",
  orator: "text-cyan-300 border-cyan-500/60",
  legend: "text-amber-300 border-amber-500/60",
};

export default function ProfileMenu({ quota, onSignIn }: { quota: QuotaView | null; onSignIn: () => void }) {
  const { data: session, status } = useSession();
  const { t } = useT();
  const [open, setOpen] = useState(false);

  if (status === "loading") {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-slate-800" />;
  }

  if (!session?.user) {
    return (
      <button
        onClick={onSignIn}
        className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-bold tracking-wider text-cyan-200 transition hover:border-cyan-300/80 hover:bg-cyan-500/20"
      >
        {t("sign_in")}
      </button>
    );
  }

  const plan = quota?.plan ?? "free";
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2" aria-haspopup="menu" aria-expanded={open}>
        <span className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={session.user.image ?? "/icon.svg"}
            alt={session.user.name ?? "me"}
            className="h-9 w-9 rounded-full border border-cyan-400/40 object-cover"
            referrerPolicy="no-referrer"
          />
          <span className={`absolute -bottom-1 -right-1 rounded-full border bg-slate-950 px-1 text-[8px] font-black uppercase ${PLAN_STYLE[plan]}`}>
            {plan === "free" ? "F" : plan === "orator" ? "O" : "L"}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }}
            className="glass-panel absolute end-0 z-50 mt-2 w-56 p-2"
            role="menu"
          >
            <div className="border-b border-slate-800 px-3 py-2">
              <div className="truncate text-sm font-bold text-slate-100">{session.user.name}</div>
              <div className="truncate text-[10px] text-slate-500">{session.user.email}</div>
              {quota && (
                <div className="mt-1.5 text-[10px] text-cyan-300">
                  {quota.limit < 0 ? `∞ ${t("plan")}` : `⚡ ${t("debates_left")}: ${quota.left}/${quota.limit} · ${t("resets_in")} ${quota.resetsInDays}d`}
                </div>
              )}
            </div>
            <Link href="/profile" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
              👤 {t("profile")}
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="block w-full rounded-lg px-3 py-2 text-start text-sm text-rose-300 hover:bg-rose-950/40"
            >
              🚪 {t("sign_out")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
