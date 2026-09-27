/**
 * AdSlot — professional, non-intrusive advertising.
 *
 * Rules of the house:
 *  • NEVER inside the debate (the cinema is sacred) — only landing,
 *    profile and post-victory surfaces.
 *  • Paid members (Orator/Legend) see zero ads.
 *  • If AdSense isn't configured yet, the slot renders a classy
 *    "house ad" (upgrade teaser / sponsor invitation) so the layout
 *    never jumps and the space is never dead.
 */
"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/lib/client/useT";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";

export default function AdSlot({ zone, showAds, onUpgrade }: {
  zone: "landing" | "profile" | "victory";
  showAds: boolean;
  onUpgrade?: () => void;
}) {
  const { t } = useT();
  const pushed = useRef(false);
  const slot = zone === "landing" ? process.env.NEXT_PUBLIC_ADSENSE_SLOT_LANDING : zone === "profile" ? process.env.NEXT_PUBLIC_ADSENSE_SLOT_PROFILE : process.env.NEXT_PUBLIC_ADSENSE_SLOT_VICTORY;

  useEffect(() => {
    if (!ADSENSE_CLIENT || !showAds || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch { /* adblock — silently */ }
  }, [showAds]);

  if (!showAds) return null;

  if (ADSENSE_CLIENT && slot) {
    return (
      <div className="mx-auto w-full max-w-md" aria-label="advertisement">
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <ins
          className="adsbygoogle block"
          style={{ display: "block" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
        <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`} crossOrigin="anonymous" />
      </div>
    );
  }

  /* house ad — elegant, on-brand, zero noise */
  return (
    <div className="mx-auto w-full max-w-md" aria-label="sponsor">
      <div className="glass-panel flex items-center justify-between gap-3 border-dashed px-4 py-3">
        <div>
          <div className="text-[9px] uppercase tracking-[0.3em] text-slate-600">{t("sponsor_line")}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">{t("ad_house_text")}</div>
        </div>
        {onUpgrade && (
          <button onClick={onUpgrade} className="shrink-0 rounded-lg border border-cyan-400/40 px-3 py-1.5 text-[10px] font-bold text-cyan-300 transition hover:bg-cyan-500/10">
            {t("upgrade")} ⭐
          </button>
        )}
      </div>
    </div>
  );
}
