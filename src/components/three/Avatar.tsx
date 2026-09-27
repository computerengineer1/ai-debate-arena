/**
 * ─────────────────────────────────────────────────────────────────────
 *  Avatar — cinematic mech sculptures (art-directed from the official
 *  character references in /public/characters):
 *
 *    LOGOS    chrome + cyan seams, almond visor eyes, smooth crown
 *    PATHOS   gunmetal plates + lava cracks, burning eyes, layered pauldrons
 *    REFEREE  gold + porcelain ceremonial armor, white glyph rings, halo crest
 *
 *  Real metal look = MeshPhysicalMaterial (clearcoat) + PMREM environment
 *  (see StudioEnv in Stage.tsx). Underneath: the same pose engine
 *  (10 emotions × 9 gestures), amplitude lip-sync jaw, and joint rig.
 * ─────────────────────────────────────────────────────────────────────
 */
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { audioBus } from "@/lib/client/audio";
import { arenaState } from "@/store/useArenaStore";
import type { Emotion, Gesture, Speaker } from "@/lib/types";

/* ───────────────────────── persona styling ───────────────────────── */

export interface PersonaConfig {
  base: string;
  emissive: string;
  accent: string;
  eye: string;
  crest: "ring" | "spikes" | "halo";
}

export const PERSONAS: Record<Speaker, PersonaConfig> = {
  logos: { base: "#8f979f", emissive: "#0ea5e9", accent: "#67e8f9", eye: "#7df3ff", crest: "ring" },
  pathos: { base: "#33383f", emissive: "#f43f5e", accent: "#fb923c", eye: "#ffb020", crest: "spikes" },
  referee: { base: "#e0b23c", emissive: "#f59e0b", accent: "#fde68a", eye: "#ffffff", crest: "halo" },
};

const EMOTION_COLOR: Record<Emotion, string> = {
  calm: "#38bdf8", thinking: "#818cf8", confident: "#22d3ee", amused: "#fbbf24",
  firm: "#60a5fa", passionate: "#fb923c", angry: "#ef4444", sarcastic: "#facc15",
  frustrated: "#f97316", victorious: "#4ade80",
};

/* ───────────────────────── material foundry ───────────────────────── */

interface MechMats {
  armor: THREE.MeshPhysicalMaterial;
  armor2: THREE.MeshPhysicalMaterial; // secondary plates / dark metal
  joint: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshStandardMaterial; // emissive seams / cracks / glyphs
  eye: THREE.MeshBasicMaterial;
  glow: THREE.MeshBasicMaterial; // mouth glow
  trimColor: THREE.Color;
}

function useMechMaterials(persona: Speaker): MechMats {
  const mats = useMemo<MechMats>(() => {
    const physical = (o: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(o);
    let armor: THREE.MeshPhysicalMaterial, armor2: THREE.MeshPhysicalMaterial, trim: THREE.MeshStandardMaterial, eye: THREE.MeshBasicMaterial;
    if (persona === "logos") {
      armor = physical({ color: "#c8cfd6", metalness: 1, roughness: 0.13, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.25 });
      armor2 = physical({ color: "#2b3138", metalness: 0.92, roughness: 0.38, envMapIntensity: 0.9 });
      trim = new THREE.MeshStandardMaterial({ color: "#062a33", emissive: "#22d3ee", emissiveIntensity: 2.4 });
      eye = new THREE.MeshBasicMaterial({ color: "#7df3ff", toneMapped: false });
    } else if (persona === "pathos") {
      armor = physical({ color: "#3a4048", metalness: 1, roughness: 0.3, envMapIntensity: 0.8 });
      armor2 = physical({ color: "#15181c", metalness: 1, roughness: 0.42, envMapIntensity: 0.6 });
      trim = new THREE.MeshStandardMaterial({ color: "#2a0d02", emissive: "#ff5a1f", emissiveIntensity: 2.8 });
      eye = new THREE.MeshBasicMaterial({ color: "#ffb020", toneMapped: false });
    } else {
      armor = physical({ color: "#dcae3c", metalness: 1, roughness: 0.24, clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 1.15 });
      armor2 = physical({ color: "#eef1f5", metalness: 0.25, roughness: 0.22, clearcoat: 1, envMapIntensity: 1.0 });
      trim = new THREE.MeshStandardMaterial({ color: "#3a2c07", emissive: "#fff3c4", emissiveIntensity: 1.9 });
      eye = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    }
    return {
      armor,
      armor2,
      trim,
      eye,
      joint: new THREE.MeshStandardMaterial({ color: "#0b0e12", metalness: 0.85, roughness: 0.5 }),
      glass: physical({ color: "#04060b", metalness: 0.7, roughness: 0.07, clearcoat: 1, transparent: true, opacity: 0.92, envMapIntensity: 1.4 }),
      glow: new THREE.MeshBasicMaterial({ color: PERSONAS[persona].accent, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, toneMapped: false, depthWrite: false }),
      trimColor: new THREE.Color(trim.emissive),
    };
  }, [persona]);

  useEffect(() => () => Object.values(mats).forEach((m) => m instanceof THREE.Material && m.dispose()), [mats]);
  return mats;
}

/* ───────────────────────── pose system (unchanged engine) ───────────────────────── */

interface Pose {
  lShX: number; lShZ: number; lElb: number;
  rShX: number; rShZ: number; rElb: number;
  headX: number; headY: number; headZ: number;
  torsoX: number; torsoY: number;
  hover: number;
}

const REST: Pose = {
  lShX: 0, lShZ: -0.1, lElb: -0.18,
  rShX: 0, rShZ: 0.1, rElb: -0.18,
  headX: 0, headY: 0, headZ: 0, torsoX: 0, torsoY: 0, hover: 0,
};

const EMOTION_POSE: Record<Emotion, Partial<Pose>> = {
  calm: { torsoX: -0.02 },
  thinking: { headX: 0.1, headZ: 0.05, rShX: -0.55, rShZ: -0.25, rElb: -1.7 },
  confident: { torsoX: -0.06, headX: -0.07, rShZ: 0.22, lShZ: -0.22 },
  amused: { headZ: 0.13, headX: -0.05, torsoY: 0.06 },
  firm: { torsoX: 0.09, headX: 0.04, lShZ: -0.28, rShZ: 0.28, lElb: -0.5, rElb: -0.5 },
  passionate: { torsoX: 0.07, lShX: -0.5, rShX: -0.5, lShZ: -0.55, rShZ: 0.55, lElb: -0.75, rElb: -0.75, headX: -0.05 },
  angry: { torsoX: 0.16, headX: 0.12, lShX: -0.25, rShX: -0.25, lShZ: -0.35, rShZ: 0.35, lElb: -1.1, rElb: -1.1 },
  sarcastic: { headZ: -0.16, headX: -0.08, torsoY: -0.1, rShZ: 0.5, rElb: -0.9, hover: 0.02 },
  frustrated: { torsoX: 0.12, headX: 0.14, lShX: -0.5, lShZ: -0.5, lElb: -1.6, rShX: -0.55, rShZ: 0.42, rElb: -1.5 },
  victorious: { lShX: -2.35, rShX: -2.35, lShZ: -0.3, rShZ: 0.3, lElb: -0.25, rElb: -0.25, headX: -0.18, hover: 0.12 },
};

const GESTURES: Record<Gesture, { dur: number; pose: Partial<Pose>; slam?: boolean }> = {
  idle: { dur: 0.01, pose: {} },
  point_finger: { dur: 2.2, pose: { rShX: -1.42, rShZ: 0.12, rElb: -0.12, torsoY: -0.14, headY: 0.12, torsoX: 0.05 } },
  hand_on_chin: { dur: 2.6, pose: { rShX: -0.72, rShZ: -0.32, rElb: -2.15, headX: 0.09, headZ: 0.04, torsoX: -0.03 } },
  arms_crossed: { dur: 2.4, pose: { lShX: -0.52, lShZ: -0.52, lElb: -1.75, rShX: -0.58, rShZ: 0.44, rElb: -1.6, headX: 0.06, torsoX: -0.04 } },
  open_hands: { dur: 2.4, pose: { lShX: -0.55, rShX: -0.55, lShZ: -0.62, rShZ: 0.62, lElb: -0.65, rElb: -0.65, torsoX: -0.05, headX: -0.05 } },
  shrug: { dur: 1.8, pose: { lShZ: -0.9, rShZ: 0.9, lShX: -0.28, rShX: -0.28, lElb: -1.15, rElb: -1.15, headZ: 0.18, headX: -0.05 } },
  fist_slam: { dur: 1.5, pose: {}, slam: true },
  lean_in: { dur: 2.2, pose: { torsoX: 0.24, headX: 0.14, lShX: -0.2, rShX: -0.2, lElb: -0.6, rElb: -0.6, hover: -0.03 } },
  arms_raised: { dur: 2.6, pose: { lShX: -2.3, rShX: -2.3, lShZ: -0.28, rShZ: 0.28, lElb: -0.3, rElb: -0.3, headX: -0.16, hover: 0.08 } },
};

const POSE_KEYS = Object.keys(REST) as (keyof Pose)[];

function lerpPose(a: Pose, b: Partial<Pose>, k: number, out: Pose) {
  for (const key of POSE_KEYS) {
    if (key in b) out[key] = a[key] + ((b[key] as number) - a[key]) * k;
    else out[key] = a[key];
  }
  return out;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

/* ───────────────────────── mech body parts ───────────────────────── */

function Hand({ m, mirror }: { m: MechMats; mirror?: boolean }) {
  const s = mirror ? -1 : 1;
  return (
    <group position={[0, -0.42, 0]}>
      <mesh material={m.armor2}><boxGeometry args={[0.07, 0.1, 0.05]} /></mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={m.armor2} position={[(i - 1) * 0.024, -0.08, 0.008]} rotation={[0.25, 0, (i - 1) * 0.12 * s]}>
          <boxGeometry args={[0.018, 0.075, 0.018]} />
        </mesh>
      ))}
      <mesh material={m.armor2} position={[0.045 * s, -0.045, 0.02]} rotation={[0.3, 0, -0.7 * s]}>
        <boxGeometry args={[0.016, 0.06, 0.016]} />
      </mesh>
    </group>
  );
}

function Arm({ m, side, persona, armRef, elbowRef }: {
  m: MechMats; side: 1 | -1; persona: Speaker;
  armRef: React.RefObject<THREE.Group>; elbowRef: React.RefObject<THREE.Group>;
}) {
  return (
    <group ref={armRef} position={[0.42 * side, 0.32, 0]}>
      {/* pauldron — layered per persona */}
      <mesh material={m.armor} position={[0.015 * side, 0.05, 0]}>
        <sphereGeometry args={[persona === "referee" ? 0.175 : 0.15, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      </mesh>
      {persona === "pathos" && (
        <mesh material={m.armor2} position={[0.07 * side, 0.015, 0]} rotation={[0, 0, -0.5 * side]}>
          <sphereGeometry args={[0.165, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.38]} />
        </mesh>
      )}
      {persona === "referee" && (
        <mesh material={m.trim} position={[0.015 * side, -0.01, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.145, 0.012, 8, 32]} />
        </mesh>
      )}
      <mesh material={m.joint}><sphereGeometry args={[0.07, 14, 14]} /></mesh>
      {/* upper arm */}
      <mesh material={m.armor2} position={[0, -0.25, 0]}><capsuleGeometry args={[0.05, 0.32, 6, 14]} /></mesh>
      {persona !== "referee" && (
        <mesh material={m.trim} position={[0.04 * side, -0.25, 0.02]}><capsuleGeometry args={[0.007, 0.28, 4, 8]} /></mesh>
      )}
      {/* elbow + forearm */}
      <group ref={elbowRef} position={[0, -0.52, 0]}>
        <mesh material={m.joint}><sphereGeometry args={[0.052, 12, 12]} /></mesh>
        <mesh material={persona === "referee" ? m.armor2 : m.armor} position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.048, 0.036, 0.34, 14]} />
        </mesh>
        <mesh material={m.armor} position={[0.01 * side, -0.18, 0.04]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[0.065, 0.22, 0.045]} />
        </mesh>
        {persona === "referee" && (
          <mesh material={m.trim} position={[0, -0.18, 0.075]}><boxGeometry args={[0.05, 0.16, 0.008]} /></mesh>
        )}
        <Hand m={m} mirror={side === -1} />
      </group>
    </group>
  );
}

function Leg({ m, side, persona, hipRef, kneeRef }: {
  m: MechMats; side: 1 | -1; persona: Speaker;
  hipRef: React.RefObject<THREE.Group>; kneeRef: React.RefObject<THREE.Group>;
}) {
  return (
    <group ref={hipRef} position={[0.14 * side, -0.5, 0]} rotation={[0.1, 0, 0.03 * side]}>
      <mesh material={m.joint}><sphereGeometry args={[0.09, 12, 12]} /></mesh>
      <mesh material={m.armor2} position={[0, -0.22, 0]}><capsuleGeometry args={[0.095, 0.3, 6, 14]} /></mesh>
      <mesh material={m.armor} position={[0.01 * side, -0.21, 0.08]}><boxGeometry args={[0.1, 0.26, 0.05]} /></mesh>
      <group ref={kneeRef} position={[0, -0.42, 0]} rotation={[-0.32, 0, 0]}>
        <mesh material={m.joint}><sphereGeometry args={[0.07, 12, 12]} /></mesh>
        <mesh material={m.armor} position={[0, -0.19, 0]}>
          <cylinderGeometry args={[0.075, 0.05, 0.3, 14]} />
        </mesh>
        <mesh material={m.armor} position={[0, -0.16, 0.06]}><boxGeometry args={[0.08, 0.24, 0.05]} /></mesh>
        {persona !== "referee" && (
          <mesh material={m.trim} position={[0, -0.16, 0.085]}><boxGeometry args={[0.014, 0.18, 0.008]} /></mesh>
        )}
        {/* foot */}
        <group position={[0, -0.37, 0]} rotation={[0.42, 0, 0]}>
          <mesh material={m.joint}><sphereGeometry args={[0.05, 10, 10]} /></mesh>
          <mesh material={m.armor2} position={[0, -0.03, 0.05]}><boxGeometry args={[0.1, 0.06, 0.24]} /></mesh>
          <mesh material={m.armor} position={[0, -0.02, 0.15]}><boxGeometry args={[0.08, 0.05, 0.08]} /></mesh>
        </group>
      </group>
    </group>
  );
}

function Head({ m, persona, headRef, jawRef, eyeL, eyeR, mouthGlow }: {
  m: MechMats; persona: Speaker;
  headRef: React.RefObject<THREE.Group>; jawRef: React.RefObject<THREE.Group>;
  eyeL: React.RefObject<THREE.Mesh>; eyeR: React.RefObject<THREE.Mesh>;
  mouthGlow: React.RefObject<THREE.Mesh>;
}) {
  return (
    <group ref={headRef} position={[0, 0.76, 0]} scale={[0.94, 0.94, 0.94]}>
      {/* skull + crown */}
      <mesh material={m.armor} scale={[0.94, 1.06, 0.99]}><sphereGeometry args={[0.26, 28, 24]} /></mesh>
      <mesh material={m.armor2} scale={[0.97, 1.0, 1.0]} position={[0, 0.02, -0.02]}>
        <sphereGeometry args={[0.262, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
      </mesh>
      {/* brow ridge */}
      <mesh material={m.armor2} position={[0, 0.115, 0.185]} rotation={[-0.25, 0, 0]}>
        <boxGeometry args={[0.21, 0.035, 0.07]} />
      </mesh>
      {/* dark glass visor */}
      <mesh material={m.glass} position={[0, 0.015, 0.1]} scale={[0.86, 0.8, 0.62]}>
        <sphereGeometry args={[0.25, 24, 20]} />
      </mesh>
      {/* eyes per persona */}
      {persona === "referee" ? (
        <>
          <mesh ref={eyeL} material={m.eye} position={[-0.088, 0.05, 0.225]}><boxGeometry args={[0.075, 0.016, 0.012]} /></mesh>
          <mesh ref={eyeR} material={m.eye} position={[0.088, 0.05, 0.225]}><boxGeometry args={[0.075, 0.016, 0.012]} /></mesh>
        </>
      ) : (
        <>
          <mesh ref={eyeL} material={m.eye} position={[-0.09, 0.05, 0.22]} scale={[1, persona === "logos" ? 0.5 : 0.85, 0.5]}>
            <sphereGeometry args={[0.042, 12, 12]} />
          </mesh>
          <mesh ref={eyeR} material={m.eye} position={[0.09, 0.05, 0.22]} scale={[1, persona === "logos" ? 0.5 : 0.85, 0.5]}>
            <sphereGeometry args={[0.042, 12, 12]} />
          </mesh>
        </>
      )}
      {/* cheek vents / side pods */}
      <mesh material={m.armor2} position={[-0.235, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.035, 12]} />
      </mesh>
      <mesh material={m.armor2} position={[0.235, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.035, 12]} />
      </mesh>
      {/* persona crest */}
      {persona === "logos" && (
        <mesh material={m.trim} position={[0, 0.33, 0]} rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[0.15, 0.01, 8, 40]} />
        </mesh>
      )}
      {persona === "pathos" && (
        <group position={[0, 0.22, -0.04]}>
          {[-0.1, 0, 0.1].map((x, i) => (
            <mesh key={i} material={m.armor2} position={[x, i === 1 ? 0.08 : 0.02, -0.05 + Math.abs(x) * -0.3]} rotation={[-0.5, 0, x * 1.8]}>
              <coneGeometry args={[0.04, 0.22 - Math.abs(x) * 0.4, 8]} />
            </mesh>
          ))}
        </group>
      )}
      {persona === "referee" && (
        <mesh material={m.trim} position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.19, 0.014, 8, 48]} />
        </mesh>
      )}
      {/* jaw (lip-sync pivot) */}
      <group ref={jawRef} position={[0, -0.09, 0.03]}>
        <mesh material={m.armor2} position={[0, -0.03, 0.14]}>
          <boxGeometry args={[0.15, 0.07, 0.13]} />
        </mesh>
        <mesh material={m.armor} position={[0, -0.055, 0.16]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.12, 0.03, 0.1]} />
        </mesh>
        <mesh ref={mouthGlow} material={m.glow} position={[0, -0.005, 0.205]} scale={[0.085, 0.022, 1]}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      </group>
    </group>
  );
}

function Torso({ m, persona, core }: { m: MechMats; persona: Speaker; core: React.RefObject<THREE.Mesh> }) {
  return (
    <>
      {/* chest shell */}
      <mesh material={m.armor} position={[0, 0.1, 0]} scale={[0.38, 0.24, 0.17]}>
        <sphereGeometry args={[1, 24, 20]} />
      </mesh>
      {/* pec plates */}
      <mesh material={m.armor} position={[-0.115, 0.16, 0.135]} rotation={[-0.15, 0.28, 0.06]}>
        <boxGeometry args={[0.18, 0.15, 0.07]} />
      </mesh>
      <mesh material={m.armor} position={[0.115, 0.16, 0.135]} rotation={[-0.15, -0.28, -0.06]}>
        <boxGeometry args={[0.18, 0.15, 0.07]} />
      </mesh>
      {/* persona chest signature */}
      {persona === "logos" && (
        <>
          <mesh material={m.trim} position={[-0.055, 0.03, 0.185]}><boxGeometry args={[0.012, 0.24, 0.012]} /></mesh>
          <mesh material={m.trim} position={[0.055, 0.03, 0.185]}><boxGeometry args={[0.012, 0.24, 0.012]} /></mesh>
        </>
      )}
      {persona === "pathos" && (
        <>
          <mesh material={m.trim} position={[0, 0.07, 0.19]} rotation={[0, 0, 0.5]}><boxGeometry args={[0.016, 0.2, 0.012]} /></mesh>
          <mesh material={m.trim} position={[-0.09, -0.01, 0.175]} rotation={[0, 0, -0.7]}><boxGeometry args={[0.014, 0.16, 0.012]} /></mesh>
          <mesh material={m.trim} position={[0.1, -0.04, 0.165]} rotation={[0, 0, 1.1]}><boxGeometry args={[0.014, 0.14, 0.012]} /></mesh>
        </>
      )}
      {persona === "referee" && (
        <>
          <mesh material={m.trim} position={[-0.11, 0.12, 0.175]}><torusGeometry args={[0.075, 0.007, 8, 32]} /></mesh>
          <mesh material={m.trim} position={[0.11, 0.12, 0.175]}><torusGeometry args={[0.075, 0.007, 8, 32]} /></mesh>
        </>
      )}
      {/* core reactor */}
      <mesh ref={core} position={[0, 0.08, 0.2]}>
        <icosahedronGeometry args={[0.055, 1]} />
        <meshBasicMaterial color={PERSONAS[persona].accent} toneMapped={false} />
      </mesh>
      {/* abdomen segments */}
      {[-0.12, -0.22, -0.32].map((y, i) => (
        <mesh key={y} material={persona === "referee" ? m.armor : m.armor2} position={[0, y, 0.02]} scale={[0.21 - i * 0.015, 0.09, 0.17]}>
          <sphereGeometry args={[1, 18, 14]} />
        </mesh>
      ))}
      <mesh material={m.trim} position={[0, -0.17, 0.02]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.195, 0.006, 6, 32]} /></mesh>
      <mesh material={m.trim} position={[0, -0.27, 0.02]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.18, 0.006, 6, 32]} /></mesh>
      {/* waist + back unit */}
      <mesh material={m.armor} position={[0, -0.44, 0]}><boxGeometry args={[0.24, 0.12, 0.18]} /></mesh>
      <mesh material={m.armor2} position={[0, 0.08, -0.19]}><boxGeometry args={[0.22, 0.26, 0.08]} /></mesh>
      <mesh material={m.trim} position={[-0.06, 0.12, -0.235]}><boxGeometry args={[0.03, 0.14, 0.01]} /></mesh>
      <mesh material={m.trim} position={[0.06, 0.12, -0.235]}><boxGeometry args={[0.03, 0.14, 0.01]} /></mesh>
      {/* collar */}
      <mesh material={m.armor} position={[0, 0.44, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.03, 10, 28]} />
      </mesh>
      <mesh material={m.joint} position={[0, 0.56, 0]}><cylinderGeometry args={[0.055, 0.07, 0.18, 12]} /></mesh>
      <mesh material={m.trim} position={[0, 0.56, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.062, 0.006, 6, 20]} /></mesh>
    </>
  );
}

/* ───────────────────────── component ───────────────────────── */

export interface AvatarProps {
  persona: Speaker;
  position: [number, number, number];
  rotationY?: number;
  onSlam?: () => void;
  alwaysVisible?: boolean;
  children?: React.ReactNode;
}

export function Avatar({ persona, position, rotationY = 0, onSlam, alwaysVisible = false, children }: AvatarProps) {
  const cfg = PERSONAS[persona];
  const m = useMechMaterials(persona);

  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const torso = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const jaw = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const elbowL = useRef<THREE.Group>(null!);
  const elbowR = useRef<THREE.Group>(null!);
  const hipL = useRef<THREE.Group>(null!);
  const hipR = useRef<THREE.Group>(null!);
  const kneeL = useRef<THREE.Group>(null!);
  const kneeR = useRef<THREE.Group>(null!);
  const core = useRef<THREE.Mesh>(null!);
  const mouthGlow = useRef<THREE.Mesh>(null!);
  const eyeL = useRef<THREE.Mesh>(null!);
  const eyeR = useRef<THREE.Mesh>(null!);
  const spot = useRef<THREE.SpotLight>(null!);
  const spotTarget = useMemo(() => new THREE.Object3D(), []);
  const poolMat = useRef<THREE.MeshBasicMaterial>(null!);

  const S = useMemo(() => ({
    currentPose: { ...REST } as Pose,
    targetPose: { ...REST } as Pose,
    gestureStart: -1,
    gesture: "idle" as Gesture,
    slamFired: false,
    enterStart: -1,
    color: new THREE.Color(cfg.emissive),
    targetColor: new THREE.Color(cfg.emissive),
    trimTarget: new THREE.Color(),
    lastTurnKey: "",
    danceT: 0,
  }), [cfg.emissive]);

  const poolTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,0.55)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.16)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);

  useFrame((state, dt) => {
    const s = arenaState();
    const t = state.clock.elapsedTime;
    const perf = s.performance;
    const speaking = perf?.speaker === persona && s.phase === "speaking";
    const isReferee = persona === "referee";
    const verdictSpeaking = isReferee && (s.phase === "verdict" || s.phase === "verdict_generating");

    /* — visibility / referee entrance — */
    if (isReferee && !alwaysVisible) {
      if (!s.refereePresent && s.phase !== "victory" && s.phase !== "gavel") {
        root.current.visible = false;
        return;
      }
      root.current.visible = true;
      if (S.enterStart < 0) S.enterStart = t;
      const p = clamp01((t - S.enterStart) / 1.9);
      root.current.position.y = position[1] + (1 - easeOutCubic(p)) * 4.2;
      root.current.scale.setScalar(0.4 + 0.6 * easeOutCubic(p));
    } else {
      root.current.visible = true;
      root.current.position.y = position[1];
      root.current.scale.setScalar(1);
    }

    /* — emotion / gesture targets — */
    const st = s;
    const turnKey = `${st.turnIndex}`;
    let emotion: Emotion = "calm";
    let gesture: Gesture = "idle";
    let intensity = 0.4;

    if (speaking && perf) {
      emotion = perf.emotion; gesture = perf.gesture; intensity = perf.intensity;
    } else if (verdictSpeaking) {
      emotion = s.phase === "verdict" ? "firm" : "thinking"; intensity = 0.6;
    } else if (s.phase === "victory" && s.winnerRevealed && st.verdict?.winner === persona) {
      emotion = "victorious"; intensity = 1;
    } else if (s.phase === "gavel" || s.phase === "victory") {
      emotion = st.verdict?.winner === persona ? "victorious" : "frustrated"; intensity = 0.8;
    } else if (perf && s.phase === "speaking") {
      emotion = perf.intensity > 0.75 ? (persona === "logos" ? "firm" : "frustrated") : "thinking";
      intensity = perf.intensity * 0.5;
      gesture = perf.intensity > 0.8 ? "arms_crossed" : "idle";
    }

    if (speaking && turnKey !== S.lastTurnKey) {
      S.lastTurnKey = turnKey; S.gesture = gesture; S.gestureStart = t; S.slamFired = false;
    }
    if (!speaking && S.gesture !== "idle" && !verdictSpeaking && !(perf && s.phase === "speaking")) {
      S.gesture = "idle"; S.gestureStart = -1;
    }

    lerpPose(REST, EMOTION_POSE[emotion] ?? {}, speaking || verdictSpeaking ? 1 : 0.65, S.targetPose);

    const gdef = GESTURES[S.gesture];
    if (gdef && S.gestureStart >= 0) {
      const p = clamp01((t - S.gestureStart) / gdef.dur);
      if (S.gesture === "fist_slam") {
        let shX: number; let elb: number; let tx: number;
        if (p < 0.45) {
          const k = easeOutCubic(p / 0.45);
          shX = -2.5 * k; elb = -0.5 * k; tx = -0.08 * k;
        } else if (p < 0.62) {
          const q = (p - 0.45) / 0.17;
          shX = -2.5 + 2.2 * q * q; elb = -0.5 - 0.9 * q; tx = -0.08 + 0.3 * q;
          if (!S.slamFired && q > 0.85) { S.slamFired = true; onSlam?.(); }
        } else {
          const q = clamp01((p - 0.62) / 0.38);
          shX = -0.3 * (1 - q); elb = -1.4 * (1 - q); tx = 0.22 * (1 - q);
        }
        S.targetPose.rShX += shX; S.targetPose.rElb += elb; S.targetPose.torsoX += tx;
        S.targetPose.headX += 0.08 * Math.sin(p * Math.PI);
      } else if (p < 1) {
        const env = Math.sin(Math.PI * p);
        for (const key of POSE_KEYS) {
          const v = gdef.pose[key];
          if (v !== undefined) S.targetPose[key] += (v - (EMOTION_POSE[emotion]?.[key] ?? 0)) * env * 0.9;
        }
      }
    }

    /* — dance easter egg — */
    if (s.danceMode && s.phase === "victory") {
      S.danceT += dt;
      const d = S.danceT;
      S.targetPose.lShX = -2.2 * (0.5 + 0.5 * Math.sin(d * 6));
      S.targetPose.rShX = -2.2 * (0.5 + 0.5 * Math.sin(d * 6 + Math.PI));
      S.targetPose.lShZ = -0.5; S.targetPose.rShZ = 0.5;
      S.targetPose.lElb = -0.4; S.targetPose.rElb = -0.4;
      S.targetPose.torsoY = Math.sin(d * 6) * 0.4;
      S.targetPose.headZ = Math.sin(d * 3) * 0.2;
      S.targetPose.headX = -0.1;
      S.targetPose.hover = Math.abs(Math.sin(d * 6)) * 0.14;
      hipL.current.rotation.y = Math.sin(d * 6) * 0.3;
      hipR.current.rotation.y = -Math.sin(d * 6) * 0.3;
      kneeL.current.rotation.x = -0.32 - Math.abs(Math.sin(d * 6)) * 0.3;
      kneeR.current.rotation.x = -0.32 - Math.abs(Math.cos(d * 6)) * 0.3;
    } else {
      S.danceT = 0;
      const kLeg = 1 - Math.exp(-dt * 4);
      hipL.current.rotation.y += (0 - hipL.current.rotation.y) * kLeg;
      hipR.current.rotation.y += (0 - hipR.current.rotation.y) * kLeg;
      kneeL.current.rotation.x += (-0.32 - kneeL.current.rotation.x) * kLeg;
      kneeR.current.rotation.x += (-0.32 - kneeR.current.rotation.x) * kLeg;
    }

    /* — smooth pose → joints — */
    const k = 1 - Math.exp(-dt * 7);
    for (const key of POSE_KEYS) S.currentPose[key] += (S.targetPose[key] - S.currentPose[key]) * k;
    const P = S.currentPose;

    torso.current.rotation.x = P.torsoX + Math.sin(t * 1.6 + (persona === "pathos" ? 2 : 0)) * 0.015;
    torso.current.rotation.y = P.torsoY;
    head.current.rotation.set(P.headX, P.headY, P.headZ);
    armL.current.rotation.set(P.lShX, 0, P.lShZ);
    armR.current.rotation.set(P.rShX, 0, P.rShZ);
    elbowL.current.rotation.x = P.lElb;
    elbowR.current.rotation.x = P.rElb;

    const breathe = Math.sin(t * 1.3 + persona.length) * 0.035;
    body.current.position.y = 1.46 + breathe + P.hover;

    /* — lip-sync — */
    const lvl = speaking || verdictSpeaking ? audioBus.level : 0;
    jaw.current.rotation.x = lvl * 0.8 + 0.02;
    (mouthGlow.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + lvl * 0.75;
    if (speaking || verdictSpeaking) {
      head.current.rotation.x += Math.sin(t * 11.3) * 0.018 * lvl;
      head.current.rotation.y += Math.sin(t * 7.7) * 0.03 * lvl;
    }
    core.current.scale.setScalar(1 + lvl * 0.4 + Math.sin(t * 2.2) * 0.05);
    const eyePulse = 1 + lvl * 0.35 + (emotion === "angry" ? Math.sin(t * 18) * 0.12 : 0);
    eyeL.current.scale.setScalar(eyePulse);
    eyeR.current.scale.setScalar(eyePulse);

    /* — emotion → light + seams — */
    const emColor = persona === "referee" ? cfg.emissive : (EMOTION_COLOR[emotion] ?? cfg.emissive);
    S.targetColor.set(speaking || verdictSpeaking ? emColor : cfg.emissive);
    S.color.lerp(S.targetColor, 1 - Math.exp(-dt * 3));
    S.trimTarget.set(intensity > 0.65 && speaking ? emColor : m.trimColor.getHex());
    m.trim.emissive.lerp(S.trimTarget, 1 - Math.exp(-dt * 3));
    m.trim.emissiveIntensity = 2 + intensity * 1.6 + lvl * 1.2;

    if (spot.current) {
      const targetI = speaking || verdictSpeaking ? 7 + intensity * 11 : persona === "referee" && s.refereePresent ? 8 : 3;
      spot.current.intensity += (targetI - spot.current.intensity) * (1 - Math.exp(-dt * 4));
      spot.current.color.copy(S.color).lerp(new THREE.Color("#ffffff"), 0.5);
    }
    if (poolMat.current) {
      poolMat.current.opacity = (speaking || verdictSpeaking ? 0.32 : 0.18) + lvl * 0.18;
      poolMat.current.color.copy(S.color);
    }
  });

  return (
    <group ref={root} position={position} rotation={[0, rotationY, 0]}>
      <spotLight
        ref={spot}
        position={[0, 5.4, 1.1]}
        angle={0.42}
        penumbra={0.85}
        intensity={4}
        distance={15}
        decay={1.6}
        color={cfg.accent}
        target={spotTarget}
      />
      <primitive object={spotTarget} position={[0, 1.5, 0]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <planeGeometry args={[2.6, 2.6]} />
        <meshBasicMaterial ref={poolMat} map={poolTex} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} color={cfg.accent} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <torusGeometry args={[0.85, 0.02, 8, 64]} />
        <meshBasicMaterial color={cfg.accent} transparent opacity={0.8} />
      </mesh>

      <group ref={body} position={[0, 1.46, 0]}>
        <group ref={torso}>
          <Torso m={m} persona={persona} core={core} />
          <Head m={m} persona={persona} headRef={head} jawRef={jaw} eyeL={eyeL} eyeR={eyeR} mouthGlow={mouthGlow} />
          <Arm m={m} side={-1} persona={persona} armRef={armL} elbowRef={elbowL} />
          <Arm m={m} side={1} persona={persona} armRef={armR} elbowRef={elbowR} />
        </group>
        <Leg m={m} side={-1} persona={persona} hipRef={hipL} kneeRef={kneeL} />
        <Leg m={m} side={1} persona={persona} hipRef={hipR} kneeRef={kneeR} />
      </group>

      {children}
    </group>
  );
}
