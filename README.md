# 🚀 AI DEBATE ARENA — *Voice of Minds*

A **cinematic, voice-driven debate website** where two AI characters — **LOGOS** (the rational
thinker) and **PATHOS** (the emotional orator) — debate your topic across **4 intense rounds**
with 3D animated avatars and ultra-realistic neural voices. Afterwards, **THE REFEREE** descends
into the arena, scores the debate on five axes, and declares a winner with a spoken verdict and a
gavel slam.

**No subtitles. No speech text on screen. Pure voice and visual performance.**

> Built with Next.js 15 (App Router) · React Three Fiber · TypeScript · Tailwind · Zustand ·
> Framer Motion · Groq (LLM) · a 4-tier neural voice engine.

---

## ✨ Feature Tour

| Area | What you get |
|---|---|
| 🧠 Debate brain | Groq LLM writes a full 8-turn script (4 rounds × 2 fighters) as strict JSON, each turn tagged with `emotion`, `intensity`, `gesture` |
| 🎙️ Voice engine | Provider chain: **Groq Orpheus** (emotion-tagged neural speech) → **ElevenLabs** (optional) → **Microsoft Edge neural voices** (free, 16 languages, native accents) → **browser Web Speech API** (last resort) |
| 🗣️ Lip-sync | Web Audio `AnalyserNode` RMS drives jaw rotation, mouth glow, head micro-motion and chest-core pulse in real time (amplitude-accurate viseme envelope) |
| 🎭 Characters | Fully procedural holographic humanoids (zero GLB downloads): LOGOS with rotating data-rings, PATHOS with flame aura + anger sparks, REFEREE with halo, golden descent beam, Scales of Justice and a gavel |
| 🎬 Cinematography | Virtual camera director: close-ups, over-the-shoulder shots, aggressive two-shots in round 3, slow push-ins in round 4, reaction cutaways during the verdict, intensity-driven handheld shake, letterbox bars |
| 🎻 Score | 100% procedural cinematic soundtrack (Web Audio): drone pad, heartbeat that accelerates with tension, risers, gavel booms, victory fanfare, auto-ducking under speech |
| ⚖️ Referee | Judges the **real transcript** on Logic / Evidence / Rhetoric / Rebuttal / Emotional impact (0–10), speaks a 30–60 s verdict, slams the gavel, tips the scales to the winner |
| 🏆 Victory | Confetti explosion, golden trophy, winner pose, icon-based score summary, 🕺 **dance mode** (button or Konami code `↑↑↓↓←→←→BA`) |
| 🌍 16 languages | EN · AR (RTL) · ES · FR · DE · ZH · JA · RU · PT · HI · TR · ID · IT · KO · NL · PL — UI, debate and voices all localized; Arabic debates route to the **ALLaM-2** specialist model |
| ⚡ Performance | Audio prefetched one turn ahead, verdict generated *during round 3* (zero wait at the end), LRU caches for TTS + scripts, lazy-loaded 3D, no external assets at all |

**Listen to real output** (synthesized by this app during QA): [`public/samples/`](public/samples/)
— `referee-verdict-en.mp3`, `pathos-angry-en.mp3`, `logos-calm-zh.mp3`, `logos-calm-ar.mp3`.

---

## 🚀 Quick Start

```bash
# 1. Install
npm install

# 2. Configure secrets
cp .env.example .env
#    → paste your Groq key into GROQ_API_KEY  (https://console.groq.com/keys)

# 3. Run
npm run dev          # http://localhost:3000
# or production:
npm run build && npm start
```

**That's it.** The Edge voice provider needs no key, so the arena works immediately.
Optional upgrades (both improve realism):

- **Groq Orpheus** — accept the one-time model terms at
  `https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english`
  (and the `orpheus-arabic-saudi` variant). Until accepted, the chain silently falls through.
- **ElevenLabs** — set `ELEVEN_API_KEY` (and optionally per-character voice IDs).

> 🔒 **Security note:** the Groq key lives only in `.env` and is used exclusively inside
> server-side API routes (`/api/debate`, `/api/tts`). It never reaches the browser bundle.
> Rotate any key that has ever been shared in chat/public.

---

## 🏗️ Architecture

```
┌────────────────────────────── Browser ──────────────────────────────┐
│  Landing (/)            Arena (/arena)                              │
│  ├ Particle field       ├ ArenaCanvas (R3F, lazy, ssr:false)        │
│  ├ 3D turntable         │   ├ Stage: lights, floor, dust            │
│  └ Setup console        │   ├ Avatar ×3 (pose engine + lip-sync)    │
│                         │   ├ DataRings / FlameAura / RefereeKit    │
│                         │   ├ Confetti + Trophy                     │
│                         │   └ CameraRig (shot grammar + shake)      │
│                         ├ HUD (round pips, emotion meters, timer)   │
│                         ├ Overlays (generating/intermission/        │
│                         │   referee card/victory/error)             │
│                         └ ControlBar (pause·restart·stop·mute·🎻·⛶) │
│                                                                      │
│  Director (showrunner state machine, zustand store)                  │
│  AudioBus  — <audio> → MediaElementSource → Analyser → master out    │
│              (RMS level @60fps → jaw/head/core; ducking; fallback    │
│               speechSynthesis with simulated syllable envelope)      │
│  Score     — procedural soundtrack (drone/heartbeat/risers/fanfare)  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │  HTTPS (JSON, base64 audio)
┌──────────────────────────────▼───────────────────────────────────────┐
│  Next.js API routes (Node runtime — keys never leave the server)     │
│  POST /api/debate  mode=script  → Groq: full 4-round JSON script     │
│                    mode=verdict → Groq: referee scoring + verdict    │
│                    (model chain: qwen3.8 → [allam-2 for AR] →        │
│                     gpt-oss-120b, repair-retry, LRU cache)           │
│  POST /api/tts     → voice chain: orpheus → elevenlabs → edge        │
│                    (emotion→prosody/tags, LRU audio cache)           │
│  GET  /api/voices  → introspection (providers, voices, languages)    │
└──────────────────────────────────────────────────────────────────────┘
```

### The show, step by step

1. **Input** — topic + both stances + language → *ENTER THE ARENA* (ripple CTA).
2. **Round 1** openings → **Round 2** evidence → **Round 3** rebuttals (camera shake,
   red auras, sparks) → **Round 4** closings (slow push-ins, emotional climax).
   The non-speaking fighter *reacts* (nods, crosses arms when the opponent gets heated).
3. **Intermission** — lights drop, vignette closes, music nearly silent (2.6 s).
4. **REFEREE ENTERS** — golden beam, descent, riser, scales materialize.
5. **Verdict** — spoken judgment with reaction cutaways → **gavel slam** (shockwaves,
   flash, boom) → scales tip to the winner → **fanfare + confetti + trophy**.
6. **Victory screen** — icon/bars summary of all 5 score axes, *key moment* caption,
   DEBATE AGAIN, 🕺 dance mode.

### Emotional AI contract

Every Groq call returns per-turn JSON:

```json
{ "text": "…", "emotion": "angry", "intensity": 0.9, "gesture": "fist_slam" }
```

The frontend maps it to: voice prosody (rate/pitch, or Orpheus tags like `[anger]`),
pose keyframes (9 gestures), aura/light color (10 emotions), music tension, and camera
shake amplitude.

---

## 🌍 Languages & Voice Casting

16 languages, each with a hand-cast trio of Microsoft neural voices (deep calm male for
LOGOS, fiery orator for PATHOS, authoritative judge for REFEREE) plus per-character
rate/pitch presets. See `src/lib/languages.ts`. Debates are *written* in the selected
language by the LLM (Arabic optionally via ALLaM-2) and *spoken* by native-accent voices.
Arabic flips the whole UI to RTL.

Upgrade path for even higher realism: set `ELEVEN_API_KEY` (`eleven_multilingual_v2`
covers all 16), or accept Orpheus terms for emotion-tagged speech in EN/AR.

### Local open-source TTS (optional, self-hosted)

The provider chain is a single file (`src/lib/server/tts.ts`) — add a 4th provider that
POSTs to a local **Coqui XTTS-v2 / F5-TTS / Fish Speech** server and slot it into
`TTS_PROVIDER_CHAIN`. The interface is `(req) => Promise<{audio: Buffer, mime} | null>`.

---

## 🧰 Project Layout

```
src/
├─ app/
│  ├─ page.tsx                 # landing (particles, 3D turntable, setup console)
│  ├─ arena/page.tsx           # the show (canvas + HUD + overlays + controls)
│  ├─ layout.tsx, globals.css, icon.svg
│  └─ api/{debate,tts,voices}/route.ts
├─ components/
│  ├─ three/  Avatar · Effects · CameraRig · Stage · ArenaCanvas · LandingPreview
│  └─ ui/     HUD · ControlBar · Overlays · LanguagePicker · RippleButton · ParticlesBg
├─ lib/
│  ├─ types.ts, languages.ts
│  ├─ server/ groq.ts · prompts.ts · tts.ts · cache.ts
│  └─ client/ director.ts · audio.ts · music.ts · useT.ts
├─ store/     useArenaStore.ts · useLangStore.ts
└─ i18n/      dictionaries.ts  (16 languages, typed, RTL-aware)
```

---

## ☁️ Deployment

**Vercel (frontend + API together — recommended)**

```bash
npm i -g vercel && vercel        # set GROQ_API_KEY etc. in Project → Settings → Env
```

API routes already declare `runtime = "nodejs"` and `maxDuration = 60`.
Edge TTS opens outbound WebSockets from the serverless function — fully supported.

**Railway / Render / any Node host**

```bash
npm run build
PORT=3000 npm start              # add env vars in the dashboard
```

**Scaling notes**
- The LRU caches are per-instance. For multi-instance deployments set `REDIS_URL`
  and swap `LruCache` in `src/lib/server/cache.ts` for a Redis store (interface-compatible
  by design); or pin TTS behind a CDN.
- WebSockets aren't required: audio is chunked over HTTP and prefetched one turn ahead,
  so playback never stalls. (A WS channel would only reduce first-token latency further.)

---

## 🩺 Troubleshooting

| Symptom | Fix |
|---|---|
| `The token '&&' is not a valid statement separator` (old Windows PowerShell) | Use `;` instead: `npm install; npm run dev` (or use Terminal/PowerShell 7) |
| No sound on the very first turn | Browser autoplay policy — click anywhere once; playback auto-resumes on your first gesture |
| Refreshing `/arena` doesn't replay the show | Intentional: a reload shows a **▶ RESUME** card (one click restarts the debate with a real user gesture) |
| Dev mode feels slow on first page load | Normal — Next compiles `/` and `/arena` once (≈20 s), then it's instant |
| "Next.js inferred your workspace root" warning | Already silenced via `outputFileTracingRoot`; delete any stray `package-lock.json` in a parent folder if it persists |

## 🎮 Controls & Easter Eggs

| Input | Action |
|---|---|
| `Space` | pause / resume |
| `Esc` | stop & exit arena |
| `D` (on victory screen) | toggle dance mode |
| `↑↑↓↓←→←→ B A` | 🕺 **Konami code** → everyone dances, disco score kicks in |

---

## 🔬 QA performed on this build

- ✅ Production build clean (`tsc --noEmit` + `next build`, zero errors)
- ✅ **Full headless rehearsal** (`scripts/e2e-visual.cjs`, real debate, real audio,
  software WebGL): all 11 acts screenshotted end-to-end — landing → generating →
  intro → LOGOS speech → PATHOS speech → round-3 heat → referee entrance → verdict →
  gavel → victory → Konami dance. See [`docs/`](docs/).
- ✅ Full pipeline against live Groq: 8-turn script in **2.6 s** (`qwen/qwen3.8-27b`),
  correct speaker alternation, escalating emotion arc, word budgets ≈ 35–45 s per speech
- ✅ All 8 turns synthesized in **5.4 s** total; TTS cache hit **15 ms**
- ✅ Referee verdict on the real transcript: balanced 5-axis scores + spoken verdict
- ✅ Chinese & Arabic end-to-end (ALLaM-2 auto-selected for AR), native neural voices
- ✅ Resilience: Groq 429 → 3-model fallback chain; Orpheus terms-not-accepted → silent
  fall-through; incomplete script → up to 3 repair attempts; all-TTS-down → browser
  voice with simulated lip movement; unhandled-rejection-free prefetching

## 🗺️ Possible next upgrades

- Rhubarb Lip Sync / NVIDIA Audio2Face phoneme-level visemes (current system is amplitude-level)
- ReadyPlayerMe GLB skins behind the same pose-engine interface
- Redis cache + WebSocket streaming for multi-region scale
- Audience voting & crowd reactions between rounds

---

*Built for maximum drama. May logic — or passion — prevail.* ⚖️🔥🧊
