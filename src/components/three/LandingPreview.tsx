/**
 * LandingPreview — the three AI characters on a slow cinematic turntable
 * for the landing page. Reuses the real Avatar component (idle poses,
 * alwaysVisible referee) with its own orbiting camera.
 */
"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import * as THREE from "three";
import { Avatar } from "./Avatar";
import { StudioEnv } from "./Stage";
import { perf } from "@/lib/client/quality";
import { DataRings, FlameAura, RefereeKit } from "./Effects";

function TurntableCamera({ focus }: { focus: number }) {
  const pos = useRef(new THREE.Vector3(0, 2.2, 7));
  const look = useRef(new THREE.Vector3(0, 1.5, 0));
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    // Gentle orbit that biases toward the focused character
    const bias = [ -0.6, 0.7, 1.6 ][focus] ?? 0.7;
    const a = Math.sin(t * 0.16) * 0.55;
    pos.current.lerp(new THREE.Vector3(bias * 0.4 - 0.3 + Math.sin(a) * 1.6, 2.55 + Math.sin(t * 0.3) * 0.12, 9.5 + Math.cos(a) * 0.6), 1 - Math.exp(-dt * 1.4));
    look.current.lerp(new THREE.Vector3(bias * 0.5 - 0.5, 1.62, -0.3), 1 - Math.exp(-dt * 1.4));
    state.camera.position.copy(pos.current);
    state.camera.lookAt(look.current);
  });
  return null;
}

export default function LandingPreview({ focus = 1 }: { focus?: number }) {
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={perf.tier === "high" ? [1, 1.5] : [0.75, 1.15]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 2.2, 7], fov: 40 }}
    >
      <Suspense fallback={null}>
        <color attach="background" args={["#03050e"]} />
        <fog attach="fog" args={["#03050e", 10, 24]} />
<StudioEnv intensity={0.55} />
        <ambientLight intensity={0.35} color="#334155" />
        <directionalLight position={[2, 6, 4]} intensity={1.2} color="#94a3b8" />
        <pointLight position={[-5, 2, 3]} intensity={16} color="#0ea5e9" distance={14} />
        <pointLight position={[5, 2, 3]} intensity={16} color="#f43f5e" distance={14} />
        <pointLight position={[0, 3.4, -3]} intensity={18} color="#fbbf24" distance={12} />

        <Avatar persona="logos" position={[-0.9, 0, 0.2]} rotationY={0.5} alwaysVisible>
          <DataRings position={[0, 0, 0]} />
        </Avatar>
        <Avatar persona="referee" position={[0.7, 0.3, -1.2]} rotationY={0} alwaysVisible>
          <RefereeKit position={[0.7, 0.3, -1.2]} />
        </Avatar>
        <Avatar persona="pathos" position={[2.3, 0, 0.2]} rotationY={-0.5} alwaysVisible>
          <FlameAura position={[0, 0, 0]} />
        </Avatar>

        {/* reflective hint floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <circleGeometry args={[9, 48]} />
          <meshStandardMaterial color="#060a1a" metalness={0.75} roughness={0.3} />
        </mesh>

        <TurntableCamera focus={focus} />
      </Suspense>
    </Canvas>
  );
}
