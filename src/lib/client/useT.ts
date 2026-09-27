/**
 * useT — tiny i18next-compatible translation hook bound to useLangStore.
 * Also keeps <html dir> in sync for RTL languages (Arabic).
 */
"use client";

import { useEffect } from "react";
import { translate, isRtl, type UiKey } from "@/i18n/dictionaries";
import { useLangStore } from "@/store/useLangStore";

export function useT() {
  const lang = useLangStore((s) => s.lang);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
    }
  }, [lang]);

  return {
    lang,
    rtl: isRtl(lang),
    t: (key: UiKey) => translate(lang, key),
  };
}
