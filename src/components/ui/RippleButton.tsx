/**
 * RippleButton — the epic "ENTER THE ARENA" CTA with material ripple,
 * gradient sweep and haptic-style press feedback.
 */
"use client";

import { useCallback, useRef, type MouseEvent, type ReactNode } from "react";

interface Props {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export default function RippleButton({ onClick, children, disabled, className = "" }: Props) {
  const host = useRef<HTMLButtonElement>(null);

  const spawn = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    const el = host.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const dot = document.createElement("span");
    dot.className = "ripple-dot";
    dot.style.width = dot.style.height = `${size}px`;
    dot.style.left = `${e.clientX - rect.left - size / 2}px`;
    dot.style.top = `${e.clientY - rect.top - size / 2}px`;
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 750);
  }, []);

  return (
    <button
      ref={host}
      disabled={disabled}
      onClick={(e) => { spawn(e); onClick(); }}
      className={`ripple-host group relative rounded-2xl px-10 py-4 text-base font-black uppercase tracking-[0.3em] text-slate-950 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${
        disabled ? "" : "hover:scale-[1.04] active:scale-[0.98] hover:shadow-[0_0_45px_rgba(34,211,238,0.55)]"
      } ${className}`}
      style={{
        background: "linear-gradient(120deg, #22d3ee 0%, #38bdf8 40%, #a78bfa 75%, #f472b6 100%)",
        backgroundSize: "200% 200%",
        animation: disabled ? undefined : "gradient-sweep 5s ease infinite",
      }}
    >
      <span className="relative z-10">{children}</span>
      <style>{`@keyframes gradient-sweep {
        0%,100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }`}</style>
    </button>
  );
}
