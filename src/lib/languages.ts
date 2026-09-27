/**
 * ─────────────────────────────────────────────────────────────────────
 *  Language registry — 16 languages, native-accent voice casting.
 *
 *  Each language maps every character to a Microsoft Edge *neural* voice
 *  (free, ultra-realistic, native accent). If ElevenLabs / Orpheus are
 *  configured they take priority for the languages they support.
 * ─────────────────────────────────────────────────────────────────────
 */
import type { Speaker } from "./types";

export interface LanguageDef {
  code: string;
  /** English name */
  name: string;
  /** Native name shown in the picker */
  nativeName: string;
  flag: string;
  rtl?: boolean;
  /** Locale used in Groq prompts, e.g. "Standard Arabic" */
  promptName: string;
  /** Edge neural voices per character */
  edgeVoices: Record<Speaker, string>;
  /** Optional pitch/rate tweaks per character: { rate: "-8%", pitch: "-4Hz" } */
  edgeOptions?: Partial<Record<Speaker, { rate?: string; pitch?: string }>>;
}

export const LANGUAGES: LanguageDef[] = [
  {
    code: "en", name: "English", nativeName: "English", flag: "🇬🇧", promptName: "English",
    edgeVoices: { logos: "en-US-ChristopherNeural", pathos: "en-US-EricNeural", referee: "en-GB-RyanNeural" },
    edgeOptions: { logos: { rate: "-6%", pitch: "-3Hz" }, pathos: { rate: "+4%" }, referee: { rate: "-10%", pitch: "-4Hz" } },
  },
  {
    code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦", rtl: true, promptName: "Modern Standard Arabic",
    edgeVoices: { logos: "ar-SA-HamedNeural", pathos: "ar-SA-ZariyahNeural", referee: "ar-EG-ShakirNeural" },
    edgeOptions: { referee: { rate: "-8%" } },
  },
  {
    code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", promptName: "Spanish (Spain)",
    edgeVoices: { logos: "es-ES-AlvaroNeural", pathos: "es-ES-ElviraNeural", referee: "es-MX-JorgeNeural" },
  },
  {
    code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", promptName: "French (France)",
    edgeVoices: { logos: "fr-FR-HenriNeural", pathos: "fr-FR-DeniseNeural", referee: "fr-FR-RemyMultilingualNeural" },
  },
  {
    code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", promptName: "German",
    edgeVoices: { logos: "de-DE-ConradNeural", pathos: "de-DE-AmalaNeural", referee: "de-DE-RalfMultilingualNeural" },
  },
  {
    code: "zh", name: "Chinese", nativeName: "中文", flag: "🇨🇳", promptName: "Mandarin Chinese",
    edgeVoices: { logos: "zh-CN-YunxiNeural", pathos: "zh-CN-XiaoxiaoNeural", referee: "zh-CN-YunjianNeural" },
    edgeOptions: { referee: { rate: "-8%" } },
  },
  {
    code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", promptName: "Japanese",
    edgeVoices: { logos: "ja-JP-KeitaNeural", pathos: "ja-JP-NanamiNeural", referee: "ja-JP-DaichiNeural" },
  },
  {
    code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺", promptName: "Russian",
    edgeVoices: { logos: "ru-RU-DmitryNeural", pathos: "ru-RU-SvetlanaNeural", referee: "ru-RU-DmitryNeural" },
    edgeOptions: { logos: { rate: "-4%" }, referee: { rate: "-12%", pitch: "-4Hz" } },
  },
  {
    code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹", promptName: "Portuguese (Brazil)",
    edgeVoices: { logos: "pt-BR-AntonioNeural", pathos: "pt-BR-FranciscaNeural", referee: "pt-PT-DuarteNeural" },
  },
  {
    code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", promptName: "Hindi",
    edgeVoices: { logos: "hi-IN-MadhurNeural", pathos: "hi-IN-SwaraNeural", referee: "hi-IN-MadhurNeural" },
    edgeOptions: { referee: { rate: "-10%", pitch: "-4Hz" } },
  },
  {
    code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷", promptName: "Turkish",
    edgeVoices: { logos: "tr-TR-AhmetNeural", pathos: "tr-TR-EmelNeural", referee: "tr-TR-AhmetNeural" },
    edgeOptions: { referee: { rate: "-10%" } },
  },
  {
    code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩", promptName: "Indonesian",
    edgeVoices: { logos: "id-ID-ArdiNeural", pathos: "id-ID-GadisNeural", referee: "id-ID-ArdiNeural" },
    edgeOptions: { referee: { rate: "-10%" } },
  },
  {
    code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹", promptName: "Italian",
    edgeVoices: { logos: "it-IT-DiegoNeural", pathos: "it-IT-ElsaNeural", referee: "it-IT-GiuseppeNeural" },
  },
  {
    code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷", promptName: "Korean",
    edgeVoices: { logos: "ko-KR-InJoonNeural", pathos: "ko-KR-SunHiNeural", referee: "ko-KR-BongJinNeural" },
  },
  {
    code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱", promptName: "Dutch",
    edgeVoices: { logos: "nl-NL-MaartenNeural", pathos: "nl-NL-FennaNeural", referee: "nl-NL-MaartenNeural" },
    edgeOptions: { referee: { rate: "-10%" } },
  },
  {
    code: "pl", name: "Polish", nativeName: "Polski", flag: "🇵🇱", promptName: "Polish",
    edgeVoices: { logos: "pl-PL-MarekNeural", pathos: "pl-PL-ZofiaNeural", referee: "pl-PL-MarekNeural" },
    edgeOptions: { referee: { rate: "-10%" } },
  },
];

export const getLanguage = (code: string): LanguageDef =>
  LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];

export const SUPPORTED_LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
