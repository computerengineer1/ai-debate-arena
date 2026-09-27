/**
 * /profile — member hub: editable profile, weekly usage, plan & upgrade.
 */
"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useT } from "@/lib/client/useT";
import { useQuota } from "@/lib/client/useQuota";
import AuthModal from "@/components/ui/AuthModal";
import PricingModal from "@/components/ui/PricingModal";
import AdSlot from "@/components/ui/AdSlot";
import ProfileMenu from "@/components/ui/ProfileMenu";
import LanguagePicker from "@/components/ui/LanguagePicker";

const TITLES = ["Analyst", "Orator", "Judge", "Philosopher", "Showman", "Logician"];

interface ProfileData {
  displayName: string;
  bio: string;
  title: string;
  createdAt: string;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { t } = useT();
  const { quota } = useQuota();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [saved, setSaved] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/profile").then((r) => (r.ok ? r.json() : null)).then((j) => j && setProfile(j.profile)).catch(() => undefined);
    }
  }, [status]);

  if (status === "loading") {
    return <div className="grid min-h-dvh place-items-center bg-[#03050e]"><div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" /></div>;
  }

  if (status === "unauthenticated") {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#03050e] p-6">
        <div className="glass-panel max-w-sm p-8 text-center">
          <div className="text-4xl">🔐</div>
          <h1 className="mt-3 text-lg font-black tracking-widest text-cyan-200">{t("profile")}</h1>
          <p className="mt-2 text-xs text-slate-400">{t("guest_wall_body")}</p>
          <button onClick={() => setAuthOpen(true)} className="mt-5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 px-6 py-2.5 text-sm font-black text-slate-950">
            {t("sign_in")}
          </button>
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </main>
    );
  }

  const showAds = (quota?.plan ?? "free") === "free";

  return (
    <main className="min-h-dvh bg-[#03050e] px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-lg font-black tracking-[0.2em] text-cyan-200">👤 {t("profile")}</h1>
          <div className="flex items-center gap-2">
            <LanguagePicker compact />
            <ProfileMenu quota={quota} onSignIn={() => setAuthOpen(true)} />
          </div>
        </header>

        {profile && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {/* identity card */}
            <div className="glass-panel p-5 md:col-span-2">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={session?.user?.image ?? "/icon.svg"} alt="" className="h-14 w-14 rounded-full border border-cyan-400/40 object-cover" referrerPolicy="no-referrer" />
                <div>
                  <div className="text-sm font-black text-slate-100">{profile.displayName}</div>
                  <div className={`text-[10px] font-bold uppercase tracking-widest ${quota?.plan === "legend" ? "text-amber-300" : quota?.plan === "orator" ? "text-cyan-300" : "text-slate-500"}`}>
                    {quota?.plan === "legend" ? "🏆 LEGEND" : quota?.plan === "orator" ? "🎙️ ORATOR" : "✨ SOPHIST"}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">{t("week_usage")}</div>
                {quota && quota.limit >= 0 ? (
                  <>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500" style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }} />
                    </div>
                    <div className="mt-1.5 text-[11px] text-slate-400">
                      {quota.used}/{quota.limit} · {t("resets_in")} {quota.resetsInDays} {t("days_word")}
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-[11px] text-cyan-300">∞ {t("plan")}</div>
                )}
              </div>

              {showAds && (
                <button onClick={() => setPricingOpen(true)} className="mt-3 w-full rounded-xl border border-amber-400/50 px-3 py-2 text-[11px] font-bold text-amber-300 transition hover:bg-amber-500/10">
                  ⭐ {t("upgrade")} — {t("ad_free_note")}
                </button>
              )}
            </div>

            {/* edit form */}
            <form
              className="glass-panel flex flex-col gap-3 p-5 md:col-span-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const r = await fetch("/api/profile", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(Object.fromEntries(fd)),
                });
                if (r.ok) {
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2000);
                }
              }}
            >
              <label className="text-[10px] uppercase tracking-widest text-slate-500">{t("display_name")}
                <input name="displayName" defaultValue={profile.displayName} maxLength={40}
                  className="mt-1 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/60" />
              </label>
              <label className="text-[10px] uppercase tracking-widest text-slate-500">{t("title_label")}
                <select name="title" defaultValue={profile.title}
                  className="mt-1 w-full rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/60">
                  {TITLES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
              <label className="text-[10px] uppercase tracking-widest text-slate-500">{t("bio")}
                <textarea name="bio" defaultValue={profile.bio} maxLength={280} rows={3}
                  className="mt-1 w-full resize-none rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/60" />
              </label>
              <button type="submit" className="mt-1 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-950 transition hover:scale-[1.02]">
                {saved ? `✓ ${t("saved")}` : `💾 ${t("save")}`}
              </button>
            </form>
          </motion.div>
        )}

        <div className="mt-6">
          <AdSlot zone="profile" showAds={showAds} onUpgrade={() => setPricingOpen(true)} />
        </div>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} currentPlan={quota?.plan} />
    </main>
  );
}
