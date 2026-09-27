/**
 * ─────────────────────────────────────────────────────────────────────
 *  Stage — assembles the arena:
 *    floor + polar grid, atmosphere, phase-reactive lighting rig,
 *    the three fighters with their persona VFX, confetti, trophy.
 *  Everything reads the store non-reactively inside useFrame.
 * ─────────────────────────────────────────────────────────────────────
 */
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Avatar, PERSONAS } from "./Avatar";
import { CameraRig } from "./CameraRig";
import { Confetti, DataRings, Dust, FlameAura, RefereeKit } from "./Effects";
import { arenaState } from "@/store/useArenaStore";
import { score } from "@/lib/client/music";
import { perf } from "@/lib/client/quality";

const LOGOS_POS: [number, number, number] = [-2.6, 0, 0.4];
const PATHOS_POS: [number, number, number] = [2.6, 0, 0.4];
const REFEREE_POS: [number, number, number] = [0, 0.55, -2.4];

/* ───────── PMREM studio env — makes the mechs read as real metal ───────── */

export function StudioEnv({ intensity = 0.38 }: { intensity?: number }) {
  const gl = useThree((st) => st.gl);
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    (window as unknown as Record<string, unknown>).__arenaScene = scene;
    // keep the arena moody: env only kisses the metal
    (scene as unknown as { environmentIntensity?: number }).environmentIntensity = intensity;
    return () => {
      env.texture.dispose();
      pmrem.dispose();
      scene.environment = null;
    };
  }, [gl, scene]);
  return null;
}

/* ───────────────── phase-reactive lighting director ───────────────── */

function LightDirector() {
  const ambient = useRef<THREE.AmbientLight>(null!);
  const key = useRef<THREE.DirectionalLight>(null!);
  const gold = useRef<THREE.PointLight>(null!);
  const flash = useRef<THREE.PointLight>(null!);
  const rimL = useRef<THREE.PointLight>(null!);
  const rimR = useRef<THREE.PointLight>(null!);
  const S = useRef({ flashT: -1, lastPhase: "" }).current;

  useFrame((state, dt) => {
    const s = arenaState();
    const t = state.clock.elapsedTime;
    if (s.phase !== S.lastPhase) {
      S.lastPhase = s.phase;
      if (s.phase === "gavel") S.flashT = t;
    }

    /* NOTE: every smoothing here uses the exponential form
       k = 1 - e^(-dt·rate), which is unconditionally stable even when a
       frame stalls for seconds (headless CI, slow laptops). The naive
       `x += (target - x) * dt * rate` form diverges for dt·rate > 2 and
       once blew the rim lights up to 1e14 candela (= white void). */
    const kSlow = 1 - Math.exp(-dt * 3);
    const kMed = 1 - Math.exp(-dt * 2.5);
    const kFast = 1 - Math.exp(-dt * 4);

    const dim = s.phase === "intermission";
    const refereeUp = s.refereePresent;

    ambient.current.intensity += ((dim ? 0.04 : 0.14) - ambient.current.intensity) * kSlow;
    key.current.intensity += ((dim ? 0.06 : 0.32) - key.current.intensity) * kSlow;
    gold.current.intensity += ((refereeUp ? 26 : 0) - gold.current.intensity) * kMed;

    // rim lights breathe with the current speaker's heat
    const heat = s.phase === "speaking" ? (s.performance?.intensity ?? 0.4) : 0.3;
    rimL.current.intensity += ((s.performance?.speaker === "logos" ? 7 + heat * 14 : 3) - rimL.current.intensity) * kFast;
    rimR.current.intensity += ((s.performance?.speaker === "pathos" ? 7 + heat * 14 : 3) - rimR.current.intensity) * kFast;

    // gavel flash decay
    if (S.flashT >= 0) {
      const p = t - S.flashT;
      flash.current.intensity = p < 0.6 ? Math.max(0, 300 * (1 - p / 0.6)) : 0;
      if (p > 0.6) S.flashT = -1;
    } else {
      flash.current.intensity = 0;
    }
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.22} color="#334155" />
      <directionalLight ref={key} position={[0, 8, 4]} intensity={0.5} color="#94a3b8" />
      <pointLight ref={rimL} position={[-4.5, 2.5, 2]} intensity={4} color="#0ea5e9" distance={12} />
      <pointLight ref={rimR} position={[4.5, 2.5, 2]} intensity={4} color="#f43f5e" distance={12} />
      <pointLight ref={gold} position={[0, 4.2, -2.4]} intensity={0} color="#fbbf24" distance={14} />
      <pointLight ref={flash} position={[0, 3, -1.5]} intensity={0} color="#fef3c7" distance={20} />
    </>
  );
}

/* ───────── runtime performance governor (weak-device safety net) ───────── */

function PerfGovernor() {
  const gl = useThree((st) => st.gl);
  const S = useRef({ frames: 0, t0: 0, checks: 0 }).current;
  useFrame((state) => {
    if (perf.dropped) return;
    if (!S.t0) S.t0 = state.clock.elapsedTime;
    S.frames++;
    const dt = state.clock.elapsedTime - S.t0;
    if (dt >= 2.5) {
      const fps = S.frames / dt;
      S.frames = 0; S.t0 = state.clock.elapsedTime; S.checks++;
      // ignore the first warmup window (shader compiles)
      if (S.checks > 1 && fps < 38) {
        perf.drop();
        gl.setPixelRatio(1);
      }
    }
  });
  return null;
}

/* ───────────────── arena floor (polar grid, no assets) ───────────────── */

function ArenaFloor() {
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    const g = c.getContext("2d")!;
    g.fillStyle = "#04060f";
    g.fillRect(0, 0, 1024, 1024);
    g.strokeStyle = "rgba(56,189,248,0.16)";
    g.lineWidth = 1.5;
    const cx = 512, cy = 512;
    for (let r = 60; r <= 500; r += 55) {
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60);
      g.lineTo(cx + Math.cos(a) * 500, cy + Math.sin(a) * 500);
      g.stroke();
    }
    // center emblem
    g.strokeStyle = "rgba(251,191,36,0.5)";
    g.lineWidth = 4;
    g.beginPath(); g.arc(cx, cy, 90, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(cx, cy, 70, 0, Math.PI * 2); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }, []);

  useFrame((state) => {
    const s = arenaState();
    const pulse = s.phase === "gavel" ? 1 : 0.35 + Math.sin(state.clock.elapsedTime * 0.8) * 0.1;
    ringMat.current.opacity = pulse;
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[12, 72]} />
        <meshStandardMaterial map={tex} color="#0a1128" metalness={0.05} roughness={0.85} />
      </mesh>
      {/* glowing rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <torusGeometry args={[12, 0.035, 8, 120]} />
        <meshBasicMaterial ref={ringMat} color="#22d3ee" transparent opacity={0.4} toneMapped={false} />
      </mesh>
      {/* void below fog */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[40, 32]} />
        <meshBasicMaterial color="#01030a" />
      </mesh>
    </group>
  );
}

/* ───────────────── winner trophy ───────────────── */

function Trophy() {
  const g = useRef<THREE.Group>(null!);
  const x = useRef(-2.6);
  const cupGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    pts.push(new THREE.Vector2(0.02, 0));
    pts.push(new THREE.Vector2(0.28, 0));
    pts.push(new THREE.Vector2(0.3, 0.06));
    pts.push(new THREE.Vector2(0.08, 0.14));
    pts.push(new THREE.Vector2(0.07, 0.42));
    pts.push(new THREE.Vector2(0.3, 0.62));
    pts.push(new THREE.Vector2(0.42, 0.95));
    pts.push(new THREE.Vector2(0.44, 1.02));
    pts.push(new THREE.Vector2(0.4, 1.02));
    pts.push(new THREE.Vector2(0.36, 0.92));
    pts.push(new THREE.Vector2(0.24, 0.62));
    pts.push(new THREE.Vector2(0.02, 0.5));
    return new THREE.LatheGeometry(pts, 32);
  }, []);

  useFrame((state, dt) => {
    const s = arenaState();
    if (s.verdict) x.current = s.verdict.winner === "pathos" ? 2.6 : -2.6;
    g.current.position.x = x.current;
    const show = (s.phase === "victory" && s.winnerRevealed) || s.danceMode;
    const targetY = show ? 2.9 : -3;
    g.current.position.y += (targetY - g.current.position.y) * (1 - Math.exp(-dt * 3));
    g.current.rotation.y += dt * 1.2;
    g.current.visible = g.current.position.y > -2;
  });

  return (
    <group ref={g} position={[-2.6, -3, 0.4]} visible={false}>
      <mesh geometry={cupGeo}>
        <meshStandardMaterial color="#fbbf24" emissive="#b45309" emissiveIntensity={0.8} metalness={1} roughness={0.15} />
      </mesh>
      {/* star */}
      <mesh position={[0, 1.35, 0]}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial color="#fef3c7" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.1, 0]} color="#fbbf24" intensity={14} distance={5} />
    </group>
  );
}

/* ───────────────── slam → music hit bridge ───────────────── */

function useSlamHit() {
  return useMemo(() => ({
    logos: () => score.hit(0.8),
    pathos: () => score.hit(1.0),
  }), []);
}

/* ───────────────── full stage ───────────────── */

export function Stage() {
  const hits = useSlamHit();

  return (
    <>
      <color attach="background" args={["#03050e"]} />
      <fog attach="fog" args={["#03050e", 12, 30]} />
      <StudioEnv />
      <PerfGovernor />
      <LightDirector />
      <ArenaFloor />
      <Dust />

      {/* ── LOGOS ── */}
      <Avatar persona="logos" position={LOGOS_POS} rotationY={Math.PI / 2 - 0.42} onSlam={hits.logos}>
        <DataRings position={[0, 0, 0]} />
      </Avatar>

      {/* ── PATHOS ── */}
      <Avatar persona="pathos" position={PATHOS_POS} rotationY={-Math.PI / 2 + 0.42} onSlam={hits.pathos}>
        <FlameAura position={[0, 0, 0]} />
      </Avatar>

      {/* ── REFEREE ── */}
      <Avatar persona="referee" position={REFEREE_POS} rotationY={0} />
      <RefereeKit position={[REFEREE_POS[0], REFEREE_POS[1], REFEREE_POS[2]]} />

      {/* referee platform */}
      <mesh position={[REFEREE_POS[0], 0.27, REFEREE_POS[2]]}>
        <cylinderGeometry args={[1.1, 1.3, 0.55, 32]} />
        <meshStandardMaterial color="#0b0903" emissive="#f59e0b" emissiveIntensity={0.05} metalness={0.5} roughness={0.55} />
      </mesh>

      <Trophy />
      <Confetti />
      <CameraRig />
    </>
  );
}

export { PERSONAS };
