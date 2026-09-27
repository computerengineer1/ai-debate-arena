/**
 * ArenaCanvas — the main debate stage renderer.
 * Lazy-loaded (dynamic import, SSR off) so three.js never blocks first paint.
 */
"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Stage } from "./Stage";
import { perf } from "@/lib/client/quality";

export default function ArenaCanvas() {
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={perf.dpr}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      camera={{ position: [0, 3.6, 10.5], fov: 42, near: 0.1, far: 80 }}
    >
      <Suspense fallback={null}>
        <Stage />
      </Suspense>
    </Canvas>
  );
}
