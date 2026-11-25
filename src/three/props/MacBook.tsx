'use client';

/**
 * Procedural silver laptop in the proportions of a 13" MacBook Air (30.4 × 21.5 cm,
 * ~1.1 cm closed). Separate base and lid; the lid group pivots on the real hinge
 * line so it can open by scroll. Reused in the hero (on his lap) and the finale
 * (camera flies into the screen). ~10 draw calls; keys are one InstancedMesh.
 */
import { forwardRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getScreenTexture } from '../assets/proceduralTextures';

export const MACBOOK = {
  width: 0.304,
  depth: 0.215,
  base: 0.0075,
  lid: 0.0042,
  openAngle: (112 * Math.PI) / 180,
  /** Display area inside the lid (metres). */
  display: { width: 0.287, height: 0.188, inset: 0.0055 },
};

function appleLogo() {
  // 100-unit outline (y up), scaled to ~3.6 cm.
  const s = new THREE.Shape();
  s.moveTo(50, 8);
  s.bezierCurveTo(38, 0, 28, 2, 20, 12);
  s.bezierCurveTo(6, 30, 4, 58, 16, 72);
  s.bezierCurveTo(26, 84, 40, 82, 50, 76);
  s.bezierCurveTo(60, 82, 74, 84, 82, 74);
  s.bezierCurveTo(86, 70, 89, 65, 91, 61);
  s.bezierCurveTo(78, 54, 76, 36, 91, 30);
  s.bezierCurveTo(86, 17, 76, 4, 66, 2);
  s.bezierCurveTo(60, 0, 55, 4, 50, 8);
  const leaf = new THREE.Shape();
  leaf.moveTo(51, 85);
  leaf.bezierCurveTo(51, 99, 61, 107, 70, 108);
  leaf.bezierCurveTo(70, 95, 62, 86, 51, 85);
  const g = new THREE.ShapeGeometry([s, leaf], 6);
  g.translate(-52, -55, 0);
  g.scale(0.00036, 0.00036, 1);
  return g;
}

interface Props {
  lidRef: React.Ref<THREE.Group>;
  /** Mesh of the display surface (for camera-into-screen maths). */
  displayRef?: React.Ref<THREE.Mesh>;
  /** 'code' = editor texture (hero); 'dark' = near-black panel (finale: real DOM is mapped on top). */
  screen?: 'code' | 'dark';
}

export const MacBook = forwardRef<THREE.Group, Props>(function MacBook({ lidRef, displayRef, screen = 'code' }, ref) {
  const { width: W, depth: D, base: B, lid: L, display } = MACBOOK;
  const r = useMemo(() => {
    const aluminium = new THREE.MeshStandardMaterial({ color: '#d9dbe0', metalness: 0.35, roughness: 0.32 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: '#2b2c31', metalness: 0.3, roughness: 0.45 });
    const keyMat = new THREE.MeshStandardMaterial({ color: '#17181b', roughness: 0.6 });
    const well = new THREE.MeshStandardMaterial({ color: '#2a2b2f', roughness: 0.7 });
    const pad = new THREE.MeshStandardMaterial({ color: '#c7c9cf', metalness: 0.25, roughness: 0.22 });
    const bezel = new THREE.MeshBasicMaterial({ color: '#08090b', toneMapped: false });
    const logoMat = new THREE.MeshStandardMaterial({ color: '#eef0f4', metalness: 0.6, roughness: 0.16 });
    const screenMat =
      screen === 'code'
        ? new THREE.MeshBasicMaterial({ map: getScreenTexture(), toneMapped: false })
        : new THREE.MeshBasicMaterial({ color: '#0c0c0d', toneMapped: false });

    // keyboard: 6 rows × 14 keys (function row half height)
    const keyGeo = new THREE.BoxGeometry(1, 1, 1);
    const keys = new THREE.InstancedMesh(keyGeo, keyMat, 6 * 14);
    const m = new THREE.Matrix4();
    const pitch = 0.0186;
    let i = 0;
    for (let row = 0; row < 6; row++) {
      const h = row === 0 ? 0.0085 : 0.0158;
      const z = -D * 0.5 + 0.026 + row * pitch - (row === 0 ? 0.0036 : 0);
      for (let c = 0; c < 14; c++) {
        const x = (c - 6.5) * pitch;
        m.compose(new THREE.Vector3(x, B + 0.0005, z), new THREE.Quaternion(), new THREE.Vector3(0.0158, 0.0008, h));
        keys.setMatrixAt(i++, m);
      }
    }
    keys.instanceMatrix.needsUpdate = true;

    return {
      materials: [aluminium, darkMetal, keyMat, well, pad, bezel, logoMat, screenMat],
      aluminium,
      darkMetal,
      well,
      pad,
      bezel,
      logoMat,
      screenMat,
      keys,
      geos: {
        base: new RoundedBoxGeometry(W, B, D, 3, 0.0035),
        lid: new RoundedBoxGeometry(W, L, D, 3, 0.002),
        well: new THREE.PlaneGeometry(14 * pitch + 0.004, 6 * pitch + 0.002),
        pad: new RoundedBoxGeometry(0.123, 0.0006, 0.078, 2, 0.0003),
        hinge: new THREE.CylinderGeometry(0.0034, 0.0034, W * 0.86, 12).rotateZ(Math.PI / 2),
        bezel: new THREE.PlaneGeometry(W - 0.003, D - 0.003),
        display: new THREE.PlaneGeometry(display.width, display.height),
        notch: new THREE.PlaneGeometry(0.031, 0.0062),
        logo: appleLogo(),
        keyGeo,
      },
    };
  }, [B, D, L, W, display.height, display.width, screen]);

  useEffect(
    () => () => {
      Object.values(r.geos).forEach((g) => g.dispose());
      r.materials.forEach((mm) => mm.dispose());
      r.keys.dispose();
    },
    [r],
  );

  // Lid-local frame: hinge at the origin, the lid extends along +Z when closed.
  // Display faces -Y when closed (toward the keyboard) and toward the user when open.
  const displayZ = D / 2 + display.inset * 0.5;
  return (
    <group ref={ref}>
      <mesh geometry={r.geos.base} material={r.aluminium} position={[0, B / 2, 0]} />
      <mesh geometry={r.geos.well} material={r.well} rotation={[-Math.PI / 2, 0, 0]} position={[0, B + 0.0002, -D * 0.5 + 0.026 + 2.5 * 0.0186]} />
      <primitive object={r.keys} />
      <mesh geometry={r.geos.pad} material={r.pad} position={[0, B + 0.0002, D * 0.29]} />
      <mesh geometry={r.geos.hinge} material={r.darkMetal} position={[0, B * 0.95, -D / 2 + 0.002]} />

      <group ref={lidRef} position={[0, B, -D / 2]}>
        <group position={[0, L / 2, D / 2]}>
          <mesh geometry={r.geos.lid} material={r.aluminium} />
          {/* outer face: logo */}
          <mesh geometry={r.geos.logo} material={r.logoMat} rotation={[-Math.PI / 2, 0, Math.PI]} position={[0, L / 2 + 0.0003, 0]} />
          {/* inner face: bezel, display, notch */}
          <mesh geometry={r.geos.bezel} material={r.bezel} rotation={[Math.PI / 2, 0, 0]} position={[0, -L / 2 - 0.0003, 0]} />
          <mesh
            ref={displayRef}
            geometry={r.geos.display}
            material={r.screenMat}
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, -L / 2 - 0.0006, displayZ - D / 2]}
          />
          <mesh geometry={r.geos.notch} material={r.bezel} rotation={[Math.PI / 2, 0, 0]} position={[0, -L / 2 - 0.0009, displayZ - D / 2 + display.height / 2 - 0.0031]} />
        </group>
      </group>
    </group>
  );
});
