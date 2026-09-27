/**
 * useLangStore — persisted UI language choice (drives BOTH the interface
 * locale/RTL and the language the fighters debate in).
 */
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isRtl } from "@/i18n/dictionaries";

interface LangState {
  lang: string;
  setLang: (l: string) => void;
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: "en",
      setLang: (lang) => set({ lang }),
    }),
    { name: "arena-lang" },
  ),
);

export const useRtl = () => isRtl(useLangStore((s) => s.lang));
