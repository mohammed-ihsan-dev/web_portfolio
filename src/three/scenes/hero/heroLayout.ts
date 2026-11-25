/**
 * Hero composition in world space (metres), solved against the canonical
 * page camera (z = 10, fov 30). Anchors are derived from the hand transforms
 * so moving a hand moves the character with it.
 */
import * as THREE from 'three';
import { characterConfig } from '@/config/character.config';
import { PALM_TOP } from './handGeometry';

type V3 = [number, number, number];

interface HandPlacement {
  position: V3;
  rotation: V3;
  scale: number;
  /** World offset applied as the hands drift out of frame during the transition. */
  exit: V3;
  /** Offset during the entrance (multiplied by 1 - entrance). */
  enter: V3;
}

const lowerHand: HandPlacement = {
  position: [-1.2, -1.3, 3.2],
  rotation: [0.3, -0.36, 0.2],
  scale: 1.32,
  exit: [-2.4, -2.2, 0.4],
  enter: [-0.5, -0.45, 0],
};

const upperHand: HandPlacement = {
  position: [2.35, 1.08, 2.0],
  rotation: [0.12, 0.3, Math.PI + 0.4],
  scale: 1.3,
  exit: [2.6, 2.0, -0.4],
  enter: [0.6, 0.45, 0],
};

const matrixOf = (h: HandPlacement) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(...h.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...h.rotation)),
    new THREE.Vector3(h.scale, h.scale, h.scale),
  );

const lowerMatrix = matrixOf(lowerHand);

/** Feet point for a standing character in the palm. */
const standPoint = new THREE.Vector3(0.1, PALM_TOP - 0.015, 0.02).applyMatrix4(lowerMatrix);
/** Hips point for a seated character on the palm's finger edge (rigged model only). */
const seatPoint = new THREE.Vector3(0.36, PALM_TOP + 0.02, 0.05).applyMatrix4(lowerMatrix);
const seatRoot = seatPoint.clone().setY(seatPoint.y - characterConfig.seat.height);

export const heroLayout = {
  /** Scroll progress windows (0–1 of the hero section). See PROJECT_PLAN.md §6. */
  timeline: {
    lid: [0.05, 0.2] as const,
    stand: [0.18, 0.33] as const,
    sky: [0.24, 0.62] as const,
    camera: [0.3, 0.64] as const,
    leap: [0.34, 0.66] as const,
    hands: [0.38, 0.74] as const,
  },
  leapHeight: 0.85,
  /** Seated character turns slightly toward the upper hand. */
  seatYaw: 0.45,
  lowerHand,
  upperHand,
  standPoint,
  seatRoot,
  laptop: {
    /** On the palm beside a standing (placeholder) character. */
    palm: new THREE.Vector3(0.38, PALM_TOP + 0.004, -0.2).applyMatrix4(lowerMatrix),
    /** On the lap of a seated (rigged) character. */
    lap: seatPoint.clone().add(new THREE.Vector3(0.18, 0.12, 0.2)),
    /** Flat on the palm (hand orientation), turned within the palm plane. */
    quaternion: new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(...lowerHand.rotation))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.9)),
  },
  camera: {
    position: new THREE.Vector3(-0.18, 0.08, 10.45),
    target: new THREE.Vector3(-0.12, 0.02, 0),
    /** Extra dolly distance at the start of the entrance. */
    entranceDolly: 0.9,
    parallax: 0.22,
  },
};
