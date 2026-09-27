/**
 * ─────────────────────────────────────────────────────────────────────
 *  Persona VFX — all procedural, zero assets:
 *    • DataRings   — LOGOS holographic fact-rings (spin up while citing)
 *    • FlameAura   — PATHOS rising embers + angry spark bursts
 *    • RefereeKit  — golden descent beam, Scales of Justice (tilt →
 *                    winner), gavel + impact sound-block, shockwaves
 *    • Confetti    — victory explosion over the winner
 *    • Dust        — ambient arena motes
 * ─────────────────────────────────────────────────────────────────────
 */
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { arenaState } from "@/store/useArenaStore";
import { audioBus } from "@/lib/client/audio";
import { perf } from "@/lib/client/quality";

/* ═══════════════════════ LOGOS — holographic data rings ═══════════════════════ */

export function DataRings({ position }: { position: [number, number, number] }) {
  const g1 = useRef<THREE.Group>(null!);
  const g2 = useRef<THREE.Group>(null!);
  const g3 = useRef<THREE.Group>(null!);
  const ticks = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const TICKS = perf.ringTicks;

  useFrame((state, dt) => {
    const s = arenaState();
    const active = s.performance?.speaker === "logos" && s.phase === "speaking";
    const boost = active ? 1 + audioBus.level * 3 + (s.performance?.intensity ?? 0.5) * 2 : 1;
    g1.current.rotation.z += dt * 0.35 * boost;
    g2.current.rotation.x += dt * 0.28 * boost;
    g2.current.rotation.y += dt * 0.12 * boost;
    g3.current.rotation.y -= dt * 0.2 * boost;
    // tick marks ride the middle ring
    for (let i = 0; i < TICKS; i++) {
      const a = (i / TICKS) * Math.PI * 2 + state.clock.elapsedTime * 0.25 * boost;
      dummy.position.set(Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0);
      dummy.rotation.set(0, -a, 0);
      const sc = active ? 0.8 + Math.abs(Math.sin(a * 3 + state.clock.elapsedTime * 4)) * 1.4 : 0.7;
      dummy.scale.set(0.012, 0.05 * sc, 0.012);
      dummy.updateMatrix();
      ticks.current.setMatrixAt(i, dummy.matrix);
    }
    ticks.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={position}>
      <group ref={g1} position={[0, 1.72, 0]} rotation={[Math.PI / 2.2, 0, 0]}>
        <mesh>
          <torusGeometry args={[0.82, 0.007, 8, 96]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} toneMapped={false} />
        </mesh>
      </group>
      <group ref={g2} position={[0, 1.72, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.0, 0.008, 8, 96]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} toneMapped={false} />
        </mesh>
        <instancedMesh ref={ticks} args={[undefined, undefined, TICKS]}>
          <boxGeometry />
          <meshBasicMaterial color="#a5f3fc" transparent opacity={0.55} toneMapped={false} />
        </instancedMesh>
      </group>
      <group ref={g3} position={[0, 1.72, 0]} rotation={[Math.PI / 1.8, 0.4, 0]}>
        <mesh>
          <torusGeometry args={[1.18, 0.005, 8, 96]} />
          <meshBasicMaterial color="#67e8f9" transparent opacity={0.35} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ═══════════════════════ PATHOS — flame aura + sparks ═══════════════════════ */

const FLAME_COUNT = perf.flames;
const SPARK_COUNT = perf.sparks;

export function FlameAura({ position }: { position: [number, number, number] }) {
  const flames = useRef<THREE.Points>(null!);
  const sparks = useRef<THREE.Points>(null!);
  const sparkMat = useRef<THREE.PointsMaterial>(null!);

  const { flameGeo, flameData, sparkGeo, sparkData } = useMemo(() => {
    const fPos = new Float32Array(FLAME_COUNT * 3);
    const fData = new Float32Array(FLAME_COUNT * 3); // speed, radius, phase
    for (let i = 0; i < FLAME_COUNT; i++) {
      const r = 0.55 + Math.random() * 0.5;
      const a = Math.random() * Math.PI * 2;
      fPos[i * 3] = Math.cos(a) * r;
      fPos[i * 3 + 1] = Math.random() * 2.4;
      fPos[i * 3 + 2] = Math.sin(a) * r;
      fData[i * 3] = 0.6 + Math.random() * 1.4; // speed
      fData[i * 3 + 1] = r;
      fData[i * 3 + 2] = a;
    }
    const flameGeo = new THREE.BufferGeometry();
    flameGeo.setAttribute("position", new THREE.BufferAttribute(fPos, 3));

    const sPos = new Float32Array(SPARK_COUNT * 3);
    const sData = new Float32Array(SPARK_COUNT * 4); // vx, vy, vz, life
    for (let i = 0; i < SPARK_COUNT; i++) {
      sPos[i * 3 + 1] = -10; // parked below floor until burst
      sData[i * 3 + 3] = 0;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    return { flameGeo, flameData: fData, sparkGeo, sparkData: sData };
  }, []);

  const burstAt = useRef(0);

  useFrame((state, dt) => {
    const s = arenaState();
    const t = state.clock.elapsedTime;
    const perf = s.performance;
    const active = perf?.speaker === "pathos" && s.phase === "speaking";
    const heat = active ? 0.4 + perf!.intensity * 0.6 + audioBus.level * 0.8 : 0.18;

    /* rising embers */
    const pos = flameGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < FLAME_COUNT; i++) {
      const speed = flameData[i * 3] * heat * 2.2;
      const r = flameData[i * 3 + 1] * (1 - pos[i * 3 + 1] * 0.12);
      const a = flameData[i * 3 + 2] + t * 0.6 * flameData[i * 3];
      pos[i * 3 + 1] += speed * dt;
      if (pos[i * 3 + 1] > 2.6) pos[i * 3 + 1] = 0.05;
      pos[i * 3] = Math.cos(a) * r + Math.sin(t * 3 + i) * 0.03;
      pos[i * 3 + 2] = Math.sin(a) * r + Math.cos(t * 2.7 + i) * 0.03;
    }
    flameGeo.attributes.position.needsUpdate = true;
    const fm = flames.current.material as THREE.PointsMaterial;
    fm.size = 0.045 + heat * 0.05;
    fm.opacity = 0.35 + heat * 0.5;

    /* angry spark bursts — triggered by high-intensity emotions */
    const angryNow = active && (perf!.emotion === "angry" || perf!.emotion === "frustrated" || perf!.intensity > 0.85);
    if (angryNow && t - burstAt.current > 0.55) {
      burstAt.current = t;
      const sp = sparkGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < SPARK_COUNT; i++) {
        sp[i * 3] = (Math.random() - 0.5) * 0.4;
        sp[i * 3 + 1] = 1.5 + Math.random() * 0.6;
        sp[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
        sparkData[i * 4] = (Math.random() - 0.5) * 3.2;
        sparkData[i * 4 + 1] = 1.5 + Math.random() * 3.5;
        sparkData[i * 4 + 2] = (Math.random() - 0.5) * 3.2;
        sparkData[i * 4 + 3] = 0.7 + Math.random() * 0.6; // life
      }
      sparkGeo.attributes.position.needsUpdate = true;
    }
    // integrate sparks
    const sp = sparkGeo.attributes.position.array as Float32Array;
    let anyAlive = false;
    for (let i = 0; i < SPARK_COUNT; i++) {
      if (sparkData[i * 4 + 3] > 0) {
        anyAlive = true;
        sparkData[i * 4 + 3] -= dt;
        sparkData[i * 4 + 1] -= 6 * dt; // gravity
        sp[i * 3] += sparkData[i * 4] * dt;
        sp[i * 3 + 1] += sparkData[i * 4 + 1] * dt;
        sp[i * 3 + 2] += sparkData[i * 4 + 2] * dt;
      } else {
        sp[i * 3 + 1] = -10;
      }
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkMat.current.opacity = anyAlive ? 0.95 : 0;
  });

  return (
    <group position={position}>
      <points ref={flames} geometry={flameGeo}>
        <pointsMaterial color="#fb923c" size={0.06} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
      <points ref={sparks} geometry={sparkGeo}>
        <pointsMaterial ref={sparkMat} color="#fde047" size={0.05} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation />
      </points>
      {/* ground heat glow */}
      <pointLight position={[0, 0.8, 0]} color="#f97316" intensity={2.2} distance={2.6} decay={2} />
    </group>
  );
}

/* ═══════════════════════ REFEREE — beam, scales, gavel ═══════════════════════ */

export function RefereeKit({ position }: { position: [number, number, number] }) {
  const beam = useRef<THREE.Mesh>(null!);
  const scales = useRef<THREE.Group>(null!);
  const beamBar = useRef<THREE.Group>(null!);
  const panL = useRef<THREE.Group>(null!);
  const panR = useRef<THREE.Group>(null!);
  const gavel = useRef<THREE.Group>(null!);
  const block = useRef<THREE.Mesh>(null!);
  const shock = useRef<THREE.Mesh>(null!);
  const shock2 = useRef<THREE.Mesh>(null!);
  const S = useRef({ slamT: -1, shockT: -1, tilt: 0, entered: false }).current;

  useFrame((state, dt) => {
    const s = arenaState();
    const t = state.clock.elapsedTime;

    /* descent beam during entrance */
    const entering = s.phase === "referee_enter";
    beam.current.visible = entering || s.phase === "verdict_generating";
    if (beam.current.visible) {
      const m = beam.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.16 + Math.abs(Math.sin(t * 3)) * 0.16;
    }

    scales.current.visible = s.refereePresent || s.phase === "victory" || s.phase === "gavel";
    block.current.visible = scales.current.visible;
    if (!scales.current.visible) return;

    /* scales behavior: deliberate wobble → tip to winner after gavel */
    let targetTilt = 0;
    if (s.phase === "verdict" || s.phase === "verdict_generating") {
      targetTilt = Math.sin(t * 1.4) * 0.18 * (1 + audioBus.level);
    } else if ((s.phase === "gavel" || s.phase === "victory") && s.verdict) {
      targetTilt = s.verdict.winner === "logos" ? -0.42 : 0.42;
    }
    S.tilt += (targetTilt - S.tilt) * (1 - Math.exp(-dt * 3));
    beamBar.current.rotation.z = S.tilt;
    // keep pans level & hanging
    panL.current.rotation.z = -S.tilt;
    panR.current.rotation.z = -S.tilt;
    scales.current.position.y = 2.75 + Math.sin(t * 0.9) * 0.05;

    /* gavel slam sequence */
    if (s.phase === "gavel" && S.slamT < 0) S.slamT = t;
    if (s.phase !== "gavel" && s.phase !== "victory") S.slamT = -1;
    const gavelVisible = s.phase === "gavel" || (s.phase === "victory" && s.winnerRevealed === false);
    gavel.current.visible = gavelVisible || s.phase === "verdict";
    if (gavel.current.visible) {
      let gy = 0; let rot = 0;
      if (S.slamT >= 0) {
        const p = t - S.slamT;
        if (p < 0.5) { gy = easeOut(p / 0.5) * 1.1; rot = -0.7 * easeOut(p / 0.5); }
        else if (p < 0.62) { const q = (p - 0.5) / 0.12; gy = 1.1 * (1 - q * q); rot = -0.7 + 1.5 * q * q; if (q > 0.9 && S.shockT < 0) S.shockT = t; }
        else { gy = 0; rot = 0.8 * Math.max(0, 1 - (p - 0.62) * 1.5); }
      } else {
        gy = 0.3 + Math.sin(t * 1.2) * 0.05; rot = -0.3; // held aloft while reading verdict
      }
      gavel.current.position.set(0.62, 1.72 + gy, 0.45);
      gavel.current.rotation.z = rot;
    }

    /* shockwaves on impact */
    for (const [mesh, delay] of [[shock.current, 0], [shock2.current, 0.12]] as const) {
      if (S.shockT >= 0) {
        const p = t - S.shockT - delay;
        if (p > 0 && p < 1.1) {
          mesh.visible = true;
          const sc = 0.5 + easeOut(p / 1.1) * 9;
          mesh.scale.setScalar(sc);
          (mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - p / 1.1);
        } else {
          mesh.visible = false;
          if (p >= 1.1 && delay === 0.12) S.shockT = -1;
        }
      } else {
        mesh.visible = false;
      }
    }
  });

  return (
    <group position={position}>
      {/* golden descent beam */}
      <mesh ref={beam} position={[0, 4.5, 0]} visible={false}>
        <cylinderGeometry args={[1.1, 1.5, 9, 24, 1, true]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.12} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* scales of justice */}
      <group ref={scales} position={[0, 2.75, -0.4]} visible={false}>
        {/* center post — gold, holds the holo beam */}
        <mesh>
          <cylinderGeometry args={[0.03, 0.05, 0.7, 12]} />
          <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.7} metalness={0.9} roughness={0.2} />
        </mesh>
        <pointLight color="#bfdbfe" intensity={2.2} distance={2.4} />
        <group ref={beamBar}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.022, 0.022, 1.7, 10]} />
            <meshBasicMaterial color="#e0f2fe" transparent opacity={0.85} toneMapped={false} />
          </mesh>
          {/* pans hang from beam ends */}
          <group ref={panL} position={[-0.85, 0, 0]}>
            <mesh position={[0, -0.28, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 0.55, 6]} />
              <meshBasicMaterial color="#f8fafc" transparent opacity={0.6} toneMapped={false} />
            </mesh>
            <mesh position={[0, -0.58, 0]}>
              <cylinderGeometry args={[0.26, 0.2, 0.04, 24, 1, true]} />
              <meshBasicMaterial color="#bae6fd" transparent opacity={0.5} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
          <group ref={panR} position={[0.85, 0, 0]}>
            <mesh position={[0, -0.28, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 0.55, 6]} />
              <meshBasicMaterial color="#f8fafc" transparent opacity={0.6} toneMapped={false} />
            </mesh>
            <mesh position={[0, -0.58, 0]}>
              <cylinderGeometry args={[0.26, 0.2, 0.04, 24, 1, true]} />
              <meshBasicMaterial color="#bae6fd" transparent opacity={0.5} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        </group>
        {/* finial */}
        <mesh position={[0, 0.42, 0]}>
          <octahedronGeometry args={[0.08, 0]} />
          <meshBasicMaterial color="#fde68a" toneMapped={false} />
        </mesh>
      </group>

      {/* the gavel */}
      <group ref={gavel} visible={false}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 0.55, 10]} />
          <meshStandardMaterial color="#a16207" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.11, 0.11, 0.2, 16]} />
          <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.8} metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* floating sound block */}
      <mesh ref={block} position={[0.62, 1.5, 0.45]} visible={false}>
        <cylinderGeometry args={[0.24, 0.28, 0.12, 20]} />
        <meshStandardMaterial color="#78350f" emissive="#f59e0b" emissiveIntensity={0.25} metalness={0.6} roughness={0.4} />
      </mesh>

      {/* impact shockwaves */}
      <mesh ref={shock} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} visible={false}>
        <torusGeometry args={[1, 0.03, 8, 72]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={shock2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} visible={false}>
        <torusGeometry args={[1, 0.015, 8, 72]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/* ═══════════════════════ Confetti (victory) ═══════════════════════ */

const CONFETTI = perf.confetti;

export function Confetti() {
  const points = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const winnerX = useRef(-2.6);
  const data = useMemo(() => {
    const arr = new Float32Array(CONFETTI * 7); // dx,y,dz,vy,spin,phase,delay — dx/dz relative to winner
    for (let i = 0; i < CONFETTI; i++) {
      arr[i * 7] = (Math.random() - 0.5) * 3.4;
      arr[i * 7 + 1] = 5 + Math.random() * 4;
      arr[i * 7 + 2] = (Math.random() - 0.5) * 3;
      arr[i * 7 + 3] = 1.1 + Math.random() * 1.6; // fall speed
      arr[i * 7 + 4] = (Math.random() - 0.5) * 10; // spin
      arr[i * 7 + 5] = Math.random() * Math.PI * 2;
      arr[i * 7 + 6] = Math.random() * 1.5; // delay
    }
    return arr;
  }, []);
  const colors = useMemo(() => {
    const palette = ["#fbbf24", "#22d3ee", "#fb7185", "#4ade80", "#a78bfa", "#ffffff"].map((h) => new THREE.Color(h));
    return palette;
  }, []);
  const startT = useRef(-1);
  const colored = useRef(false);

  useFrame((state) => {
    /* assign per-instance colors once (InstancedMesh.instanceColor) */
    if (!colored.current && points.current) {
      for (let i = 0; i < CONFETTI; i++) {
        points.current.setColorAt(i, colors[i % colors.length]);
      }
      if (points.current.instanceColor) points.current.instanceColor.needsUpdate = true;
      colored.current = true;
    }
    const s = arenaState();
    if (s.verdict) winnerX.current = s.verdict.winner === "pathos" ? 2.6 : -2.6;
    const active = s.phase === "victory" || s.phase === "gavel";
    points.current.visible = active || s.danceMode;
    if (!points.current.visible) return;
    if (startT.current < 0) startT.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - startT.current;
    for (let i = 0; i < CONFETTI; i++) {
      const d = data[i * 7 + 6];
      const p = Math.max(0, t - d);
      let y = data[i * 7 + 1] - data[i * 7 + 3] * p;
      if (y < 0.03) y = ((y % 9) + 9) % 9; // loop gently
      const sway = Math.sin(p * 2.2 + data[i * 7 + 5]) * 0.35;
      dummy.position.set(winnerX.current + data[i * 7] + sway, y, data[i * 7 + 2] + Math.cos(p * 1.7 + data[i * 7 + 5]) * 0.25);
      dummy.rotation.set(p * data[i * 7 + 4], p * data[i * 7 + 4] * 0.7, data[i * 7 + 5]);
      dummy.scale.set(0.09, 0.055, 0.01);
      dummy.updateMatrix();
      points.current.setMatrixAt(i, dummy.matrix);
    }
    points.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={points} args={[undefined, undefined, CONFETTI]} frustumCulled={false}>
      <planeGeometry />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}

/* ═══════════════════════ Ambient dust ═══════════════════════ */

export function Dust() {
  const ref = useRef<THREE.Points>(null!);
  const COUNT = 400;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 1] = Math.random() * 7;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame((state, dt) => {
    ref.current.visible = perf.dust;
    if (!ref.current.visible) return;
    ref.current.rotation.y += dt * 0.01;
    const pos = geo.attributes.position.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i += 4) {
      pos[i * 3 + 1] += Math.sin(t * 0.5 + i) * 0.0015;
    }
    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#64748b" size={0.03} transparent opacity={0.4} depthWrite={false} sizeAttenuation />
    </points>
  );
}
