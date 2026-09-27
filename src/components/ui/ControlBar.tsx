/**
 * ControlBar — transport controls: pause/resume, restart, stop(exit),
 * mute, music toggle, fullscreen. Bottom-center, glassy, minimal.
 */
"use client";

import { useRouter } from "next/navigation";
import { useArenaStore } from "@/store/useArenaStore";
import { director } from "@/lib/client/director";
import { audioBus } from "@/lib/client/audio";
import { score } from "@/lib/client/music";
import { useT } from "@/lib/client/useT";

function IconBtn({ label, onClick, active = true, children }: {
  label: string; onClick: () => void; active?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-xl border text-sm backdrop-blur transition-all hover:scale-110 sm:h-10 sm:w-10 sm:text-base ${
        active
          ? "border-cyan-400/30 bg-slate-900/70 text-cyan-100 hover:border-cyan-300/70 hover:shadow-[0_0_16px_#22d3ee55]"
          : "border-slate-700/50 bg-slate-900/60 text-slate-500"
      }`}
    >
      {children}
    </button>
  );
}

export default function ControlBar() {
  const paused = useArenaStore((s) => s.paused);
  const muted = useArenaStore((s) => s.muted);
  const musicOn = useArenaStore((s) => s.musicOn);
  const phase = useArenaStore((s) => s.phase);
  const { t } = useT();
  const router = useRouter();

  const running = !["idle", "stopped", "error", "victory"].includes(phase);

  return (
    <div className="safe-b absolute bottom-2 left-1/2 z-30 -translate-x-1/2 sm:bottom-5">
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-slate-700/50 bg-slate-950/70 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:gap-2 sm:p-2">
        <IconBtn label={paused ? t("resume") : t("pause")} onClick={() => director.togglePause()} active={running}>
          {paused ? "▶️" : "⏸️"}
        </IconBtn>
        <IconBtn label={t("restart")} onClick={() => director.restart()} active={running || phase === "victory"}>
          🔄
        </IconBtn>
        <IconBtn
          label={t("stop")}
          onClick={() => { director.stop(); router.push("/"); }}
        >
          ⏹️
        </IconBtn>

        <div className="mx-0.5 h-6 w-px bg-slate-700/60 sm:mx-1" />

        <IconBtn
          label={muted ? "Unmute" : "Mute"}
          active={!muted}
          onClick={() => {
            const m = !useArenaStore.getState().muted;
            useArenaStore.getState().setMuted(m);
            audioBus.setMuted(m);
          }}
        >
          {muted ? "🔇" : "🔊"}
        </IconBtn>
        <IconBtn
          label="Score"
          active={musicOn}
          onClick={() => {
            const on = !useArenaStore.getState().musicOn;
            useArenaStore.getState().setMusicOn(on);
            score.setEnabled(on);
          }}
        >
          {musicOn ? "🎻" : "🎵"}
        </IconBtn>
        <IconBtn
          label="Fullscreen"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen().catch(() => undefined);
          }}
        >
          ⛶
        </IconBtn>
      </div>
    </div>
  );
}
