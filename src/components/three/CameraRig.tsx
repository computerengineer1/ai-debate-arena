/**
 * ─────────────────────────────────────────────────────────────────────
 *  CameraRig — the virtual cinematographer.
 *
 *  Shot grammar:
 *    intro          wide crane settling over the arena
 *    speaking       cycles close-up / over-the-shoulder / two-shot;
 *                   round 3 = aggressive tight two-shots + shake;
 *                   round 4 = slow push-in on the speaker (climax)
 *    transition     gentle pull-back breath
 *    intermission   high, slow orbit — the calm before the verdict
 *    referee_enter  tilt-down following the descent
 *    verdict        medium on the referee, periodic reaction cutaways
 *    gavel          punch-in on the scales → wide on the shockwave
 *    victory        hero orbit around the winner (confetti framing)
 *
 *  Shake amplitude follows emotion intensity; all moves are damped.
 * ─────────────────────────────────────────────────────────────────────
 */
"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { arenaState } from "@/store/useArenaStore";

const LOGOS_X = -2.6;
const PATHOS_X = 2.6;
const REF_POS = new THREE.Vector3(0, 1.9, -2.4);

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const pos = useRef(new THREE.Vector3(0, 3.6, 10.5));
  const look = useRef(new THREE.Vector3(0, 1.6, 0));
  const shakeSeed = useRef(Math.random() * 100);
  const phaseT = useRef(0);
  const lastPhase = useRef<string>("");

  useFrame((state, dt) => {
    const s = arenaState();
    const t = state.clock.elapsedTime;
    if (s.phase !== lastPhase.current) {
      lastPhase.current = s.phase;
      phaseT.current = t;
    }
    const pt = t - phaseT.current; // seconds inside current phase
    const perf = s.performance;
    const target = new THREE.Vector3();
    const targetLook = new THREE.Vector3();
    let shake = 0;
    let lerpSpeed = 1.6; // cinematic: slow, heavy moves

    const speakerX = perf?.speaker === "pathos" ? PATHOS_X : LOGOS_X;
    const listenerX = perf?.speaker === "pathos" ? LOGOS_X : PATHOS_X;
    const intensity = perf?.intensity ?? 0.4;

    switch (s.phase) {
      case "idle":
      case "generating":
        target.set(Math.sin(t * 0.08) * 1.5, 3.2, 10);
        targetLook.set(0, 1.7, 0);
        break;

      case "intro": {
        // crane down + push in
        const p = Math.min(1, pt / 2.6);
        target.set(0, 3.6 - p * 1.1, 10.5 - p * 2.6);
        targetLook.set(0, 1.9 - p * 0.2, 0);
        break;
      }

      case "speaking": {
        const round = perf?.round ?? 1;
        const idx = s.turnIndex;
        const headY = 2.08;
        if (round === 4) {
          // climax: slow push-in close-up
          const push = Math.min(pt * 0.09, 0.9);
          target.set(speakerX * 0.5, 2.05, 4.3 - push);
          targetLook.set(speakerX * 0.88, headY - 0.1, 0);
          shake = intensity * 0.5;
          lerpSpeed = 0.9;
        } else if (round === 3) {
          // confrontation: tight two-shot from the side, alternating
          if (idx % 2 === 0) {
            target.set(speakerX * 0.35, 2.15, 4.2);
            targetLook.set(speakerX * 0.8, headY - 0.05, 0);
          } else {
            // over-the-shoulder from behind the listener
            target.set(listenerX * 0.75, 2.25, 2.1);
            targetLook.set(speakerX, headY, 0);
          }
          shake = intensity * 1.4;
          lerpSpeed = 2.2; // snappier cuts feel aggressive
        } else if (idx % 2 === 0) {
          // hero close-up on the speaker
          target.set(speakerX * 0.42, 2.15, 4.6);
          targetLook.set(speakerX * 0.92, headY - 0.12, 0);
          shake = intensity * 0.3;
        } else {
          // over-the-shoulder
          target.set(listenerX * 0.62, 2.25, 3.0);
          targetLook.set(speakerX, headY - 0.08, 0);
          shake = intensity * 0.4;
        }
        break;
      }

      case "transition":
        target.set(0, 2.6, 6.2);
        targetLook.set(0, 1.7, 0);
        lerpSpeed = 1.1;
        break;

      case "intermission": {
        // high slow orbit, arena barely lit
        const a = t * 0.12;
        target.set(Math.sin(a) * 7.5, 4.6, Math.cos(a) * 7.5);
        targetLook.set(0, 1.4, 0);
        lerpSpeed = 0.7;
        break;
      }

      case "referee_enter": {
        // follow the descent, then settle
        const p = Math.min(1, pt / 1.9);
        target.set(0.4, 5.2 - p * 2.7, 5.4 - p * 1.4);
        targetLook.lerpVectors(new THREE.Vector3(0, 4.2, -2.4), REF_POS, p);
        lerpSpeed = 1.3;
        break;
      }

      case "verdict_generating":
        target.set(0.5, 2.3, 3.4);
        targetLook.copy(REF_POS);
        break;

      case "verdict": {
        // medium on referee; every ~6s cut to a fighter's reaction
        const slot = Math.floor(pt / 6) % 3;
        if (slot === 1) {
          target.set(LOGOS_X * 0.6, 2.0, 3.2);
          targetLook.set(LOGOS_X, 1.95, 0);
          lerpSpeed = 2.6; // deliberate cut feel
        } else if (slot === 2) {
          target.set(PATHOS_X * 0.6, 2.0, 3.2);
          targetLook.set(PATHOS_X, 1.95, 0);
          lerpSpeed = 2.6;
        } else {
          const drift = Math.sin(t * 0.3) * 0.4;
          target.set(drift, 2.25, 3.1);
          targetLook.copy(REF_POS);
          lerpSpeed = 0.9;
        }
        break;
      }

      case "gavel": {
        // punch-in on the scales, then wide for the shockwave
        if (pt < 1.0) {
          const p = Math.min(1, pt / 0.5);
          target.lerpVectors(new THREE.Vector3(0.5, 2.3, 3.4), new THREE.Vector3(0.5, 3.2, 1.9), p);
          targetLook.set(0, 3.1, -2.7);
          lerpSpeed = 3.2;
        } else {
          const p = Math.min(1, (pt - 1.0) / 1.2);
          target.lerpVectors(new THREE.Vector3(0.5, 3.2, 1.9), new THREE.Vector3(0, 3.4, 7.5), p);
          targetLook.set(0, 1.8, -0.8);
          lerpSpeed = 1.4;
        }
        shake = pt < 1.2 ? 2.2 : 0.4;
        break;
      }

      case "victory": {
        const winnerX = s.verdict?.winner === "pathos" ? PATHOS_X : LOGOS_X;
        if (s.danceMode) {
          const a = t * 0.5;
          target.set(Math.sin(a) * 6.5, 3.0, Math.cos(a) * 6.5);
          targetLook.set(0, 1.7, 0);
        } else {
          // hero orbit around the winner
          const a = t * 0.28 + Math.PI * 0.15;
          target.set(winnerX + Math.sin(a) * 3.4, 2.3 + Math.sin(t * 0.4) * 0.2, Math.cos(a) * 3.4);
          targetLook.set(winnerX * 0.9, 1.8, 0);
        }
        lerpSpeed = 1.1;
        break;
      }

      default:
        target.set(0, 3.0, 9);
        targetLook.set(0, 1.6, 0);
    }

    /* damped move */
    const k = 1 - Math.exp(-dt * lerpSpeed);
    pos.current.lerp(target, k);
    look.current.lerp(targetLook, k);

    /* intensity shake (layered sines = organic handheld feel) */
    if (shake > 0.01) {
      const sd = shakeSeed.current;
      const amp = shake * 0.035;
      pos.current.x += Math.sin(t * 17.3 + sd) * amp;
      pos.current.y += Math.sin(t * 23.7 + sd * 2) * amp * 0.8;
      pos.current.z += Math.sin(t * 13.1 + sd * 3) * amp * 0.5;
    }

    camera.position.copy(pos.current);
    camera.lookAt(look.current);
  });

  return null;
}
