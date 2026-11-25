'use client';

/**
 * Finale (3D half). The hero's MacBook returns closed, seen from above; the lid
 * opens on its hinge while the camera swings to the front; then the camera
 * flies along the display normal until the screen covers the viewport.
 *
 * Every frame the real HTML footer is projected onto the display's four
 * corners with a CSS homography. In the last stretch the corners ease to the
 * viewport corners, so the transform ends as the identity: the visitor is
 * simply inside the page footer — same element, no swap, no fade.
 */
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { easeInOutCubic, lerp, range, smoothstep } from '@/lib/math';
import { bus } from '@/lib/scene-bus';
import { solved } from '../../director/director';
import { MacBook, MACBOOK } from '../../props/MacBook';
import { rectToQuadMatrix3d } from './homography';

export const FINALE_TIMELINE = {
  open: [0.1, 0.42] as const,
  orbit: [0.06, 0.45] as const,
  fly: [0.46, 0.9] as const,
  settle: [0.9, 0.9995] as const,
};

export function FinaleScene() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const root = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const display = useRef<THREE.Mesh>(null);
  const s = useMemo(
    () => ({
      target: new THREE.Vector3(),
      orbit: new THREE.Vector3(),
      aligned: new THREE.Vector3(),
      look: new THREE.Vector3(),
      centre: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      v: new THREE.Vector3(),
      corners: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
      quad: new Float32Array(8),
      last: '',
    }),
    [],
  );

  useFrame((state) => {
    const g = root.current;
    const el = bus.finale.screen;
    const f = solved.finale;
    if (g) g.visible = f.active === true; // three only skips `visible === false`
    if (!g || !lid.current || !display.current || !f.active || !el) return;
    const T = FINALE_TIMELINE;
    const q = f.q;
    const { width: vw, height: vh } = state.size;

    /* lid on its hinge */
    const open = smoothstep(range(q, T.open[0], T.open[1]));
    lid.current.rotation.x = -MACBOOK.openAngle * open;
    g.updateMatrixWorld(true);

    /* camera: top view → front orbit → along the screen normal */
    const o = easeInOutCubic(range(q, T.orbit[0], T.orbit[1]));
    const elevation = lerp(1.36, 0.2, o);
    const radius = lerp(0.74, 0.92, o);
    s.target.set(0, 0.07 * open, 0);
    s.orbit.set(0, Math.sin(elevation), Math.cos(elevation)).multiplyScalar(radius).add(s.target);

    display.current.getWorldPosition(s.centre);
    s.normal.set(0, 0, 1).transformDirection(display.current.matrixWorld);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const aspect = vw / vh;
    // Distance at which the display covers the viewport in both directions.
    const dFill = Math.min(MACBOOK.display.height / 2 / tan, MACBOOK.display.width / 2 / (tan * aspect)) * 0.985;
    s.aligned.copy(s.centre).addScaledVector(s.normal, dFill);

    const k = easeInOutCubic(range(q, T.fly[0], T.fly[1]));
    camera.position.lerpVectors(s.orbit, s.aligned, k);
    s.look.lerpVectors(s.target, s.centre, k);
    camera.up.set(0, 1, 0);
    camera.lookAt(s.look);
    camera.updateMatrixWorld();

    /* project the display corners → CSS homography for the real footer */
    const { width: dw, height: dh } = MACBOOK.display;
    const local: [number, number][] = [
      [-dw / 2, dh / 2],
      [dw / 2, dh / 2],
      [dw / 2, -dh / 2],
      [-dw / 2, -dh / 2],
    ];
    let behind = false;
    for (let i = 0; i < 4; i++) {
      const c = s.corners[i].set(local[i][0], local[i][1], 0).applyMatrix4(display.current.matrixWorld);
      s.v.copy(c).applyMatrix4(camera.matrixWorldInverse);
      if (s.v.z > -camera.near) behind = true;
      c.project(camera);
      s.quad[i * 2] = ((c.x + 1) / 2) * vw;
      s.quad[i * 2 + 1] = ((1 - c.y) / 2) * vh;
    }
    // Final stretch: ease the corners onto the viewport → identity transform.
    const settle = smoothstep(range(q, T.settle[0], T.settle[1]));
    const full = [0, 0, vw, 0, vw, vh, 0, vh];
    for (let i = 0; i < 8; i++) s.quad[i] = lerp(s.quad[i], full[i], settle);

    const [x0, y0, x1, y1, x2, y2] = s.quad;
    const frontFacing = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1) > 0;
    const matrix = !behind && frontFacing && open > 0.35 ? rectToQuadMatrix3d(vw, vh, s.quad) : null;
    if (matrix) {
      if (matrix !== s.last) el.style.transform = matrix;
      s.last = matrix;
      el.style.visibility = 'visible';
    } else {
      el.style.visibility = 'hidden';
    }
  });

  return (
    <group ref={root} visible={false}>
      <MacBook lidRef={lid} displayRef={display} screen="dark" />
    </group>
  );
}
