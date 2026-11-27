/**
 * Hero composition in world space (metres), solved against the canonical
 * page camera (z = 10, fov 30). Anchors are derived from the hand transforms
 * so moving a hand moves the character and laptop with it.
 */
import * as THREE from 'three';
import { characterConfig } from '@/config/character.config';
import { anchorOffset } from '../../puppet/puppets';
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
  position: [1.9, 0.72, 2.2],
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
const handQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...lowerHand.rotation));
const Y = new THREE.Vector3(0, 1, 0);
/** A point on the lower palm's surface (hand-local metres before scale). */
const palm = (x: number, z: number, lift = 0) => new THREE.Vector3(x, PALM_TOP + lift, z).applyMatrix4(lowerMatrix);

/**
 * Where he sits: on top of the index finger's first segment, the edge nearest the
 * camera, so the lower legs hang visibly over the side (a real seat, not a kneel).
 * `seatGround` is the finger surface; the hip joint sits ~11 cm above it.
 */
const seatGround = palm(0.66, 0.34, -0.02);
// Pushed toward the camera so the hanging shins draw in front of the finger edge.
const seatHips = seatGround.clone().add(new THREE.Vector3(0, 0.3, 0.36));

/**
 * The hero renders (seated with the MacBook → closing it → rising) share one seat
 * point on top of the finger, slightly toward the camera so the hanging legs read
 * in front of it. The closing and rising renders come from one scene and camera,
 * so their own anchors (hips, feet, the held laptop) follow from the same point.
 */
const puppetSeat = seatGround.clone().add(new THREE.Vector3(0.0, 0.012, 0.12));
const off = (id: 'hero-macbook' | 'hero-rising', to: string) => {
  const [x, y] = anchorOffset(id, 'seat', to);
  return new THREE.Vector3(x, y, 0);
};
/** Where the rising render's hips are: the base pose takes over from here. */
const risingHips = puppetSeat.clone().add(off('hero-rising', 'hips'));
/** The rising render's feet: he finishes standing up here. */
const risingFeet = puppetSeat.clone().add(off('hero-rising', 'feet'));
/** The MacBook held at his side in the rising render: the 3D MacBook takes over exactly here. */
const heldLaptop = puppetSeat.clone().add(off('hero-rising', 'laptopCentre')).add(new THREE.Vector3(0, 0, 0.06));
/** Closed, standing on its hinge edge, lid (logo) toward the camera, turned and leaning as in the render (top tipped back a little so the lid catches the key light). */
const heldQuaternion = new THREE.Quaternion()
  .setFromAxisAngle(Y, 0.5)
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.28))
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.15 + Math.PI))
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));

export const heroLayout = {
  /** Scroll progress windows (0–1 of the hero section). See ZERO_BUDGET_PLAN.md §6. */
  timeline: {
    /** Typing in the seated render, then he stops: hands come off the keys, head lifts. */
    settle: [0.08, 0.12] as const,
    /** Seated render → closing render (he closes the MacBook; head and eyes lift). */
    toClosing: [0.12, 0.16] as const,
    /** Closing render → rising render (off the finger, MacBook in one hand). */
    toRising: [0.2, 0.24] as const,
    /** Rising render → base pose; the 3D MacBook takes over in his hand. */
    toBase: [0.265, 0.3] as const,
    /** GLB path only: the lid closes. */
    lid: [0.12, 0.16] as const,
    /** The 3D MacBook goes from his hand down onto the palm. */
    aside: [0.29, 0.345] as const,
    stand: [0.275, 0.35] as const,
    crouch: [0.35, 0.39] as const,
    /** Feet travel from the palm to the landing station; launch and touch-down are the first/last 3 %. */
    leap: [0.39, 0.63] as const,
    recover: [0.63, 0.7] as const,
    sky: [0.26, 0.62] as const,
    camera: [0.33, 0.64] as const,
    hands: [0.42, 0.76] as const,
  },
  leapHeight: 0.5,
  /** Rigged GLB only: the seated character turns slightly toward the upper hand. */
  seatYaw: 0.45,
  lowerHand,
  upperHand,
  seatGround,
  seatHips,
  /** He stands up in place where the rising render's feet are, then crouches and leaps from there. */
  standFeet: risingFeet,
  puppetSeat,
  risingHips,
  /** Rigged GLB only: root (feet) position while seated. */
  seatRoot: seatHips.clone().setY(seatHips.y - characterConfig.seat.height),
  laptop: {
    /** In his hand at his side, exactly where the rising render holds it. */
    lap: heldLaptop,
    lapQuaternion: heldQuaternion,
    /** Set down on the palm beside him once closed. */
    aside: palm(0.3, -0.2, 0.004),
    asideQuaternion: handQuat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, Math.PI - 0.5)),
  },
  camera: {
    // Closer than the page camera, so the seated figure reads larger; the
    // transition dollies back out to the canonical camera as he leaps.
    position: new THREE.Vector3(-0.66, -0.4, 8.0),
    target: new THREE.Vector3(-0.52, -0.5, 0),
    /** Extra dolly distance at the start of the entrance. */
    entranceDolly: 0.9,
    parallax: 0.22,
  },
};
