'use client';

/**
 * Dedicated pose renders as layered puppets. Each puppet mounts when the
 * director first asks for it (scene-based preloading), loads only its own
 * layer textures, and reports itself ready; the director never hands the
 * character to a puppet that is not ready, so nothing pops or disappears.
 *
 * PuppetActor draws whichever puppet owns the character this frame.
 * DeskSet draws the photographed workspace (chair, desk, monitor, mug and the
 * seated character) plus a procedural desk front so it stands on the floor.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { solved } from '../director/director';
import { requestFrames } from '../canvas/FrameDriver';
import { ORIGIN } from '../director/puppetDirector';
import { buildPuppet, type Puppet } from './buildPuppet';
import { lowestSole } from './clips';
import { getPuppet, toLocal, type PuppetAsset, type PuppetId } from './puppets';
import { HERO_PUPPETS, readyPuppets, requestedPuppets } from './runtime';

const ACTORS: PuppetId[] = ['hero-macbook', 'hero-closing', 'hero-rising', 'flying', 'walking'];
const RENDER_ORDER: Record<PuppetId, number> = { 'hero-macbook': 12, 'hero-closing': 12, 'hero-rising': 12, flying: 12, walking: 12, desk: 6 };

function usePuppet(asset: PuppetAsset) {
  const urls = asset.layers.map((l) => l.src);
  const list = useTexture(urls, (t) => {
    for (const tex of Array.isArray(t) ? t : [t]) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      tex.generateMipmaps = true;
    }
  });
  const textures = useMemo(() => Object.fromEntries(asset.layers.map((l, i) => [l.name, list[i]])), [asset, list]);
  const puppet = useMemo(() => {
    const p = buildPuppet(asset, textures, ORIGIN[asset.id], RENDER_ORDER[asset.id]);
    // 2D compositing: draw order decides occlusion, not depth.
    for (const m of Object.values(p.materials)) m.depthTest = false;
    return p;
  }, [asset, textures]);
  useEffect(() => {
    readyPuppets.add(asset.id);
    // the render loop sleeps when nothing is on screen: wake it so the new render can take over
    requestFrames(3);
    return () => {
      readyPuppets.delete(asset.id);
      puppet.dispose();
    };
  }, [asset.id, puppet]);
  return puppet;
}

function PuppetActor({ asset }: { asset: PuppetAsset }) {
  const puppet: Puppet = usePuppet(asset);
  const group = useRef<THREE.Group>(null);
  const layerMeshes = useMemo(() => asset.layers.map((l) => puppet.meshes[l.name]).filter(Boolean), [asset, puppet]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    // on top (owns the character) or underneath (fading in during a hand-over)
    const top = solved.puppet.id === asset.id;
    const s = top ? solved.puppet : solved.puppetUnder;
    g.visible = top || solved.puppetUnder.id === asset.id;
    if (!g.visible) return;
    // over the base pose (10) when on top; under the outgoing render (12+) when fading in
    layerMeshes.forEach((m, i) => (m.renderOrder = (top ? 12 : 7) + i));
    puppet.setOpacity(s.opacity);
    puppet.setPose(s.pose);
    g.position.copy(s.pos);
    if (s.grounded && asset.id === 'walking') g.position.y -= lowestSole('walking', s.pose, ORIGIN.walking);
    g.rotation.set(0, 0, s.rot);
    g.scale.set(s.flip ? -s.scale : s.scale, s.scale, s.scale);
  });
  return (
    <group ref={group} visible={false}>
      <primitive object={puppet.group} />
    </group>
  );
}

/** Procedural desk front (desk-top continuation below the render, front edge, modesty panel, legs). */
function useDeskBase(asset: PuppetAsset) {
  return useMemo(() => {
    const d = asset.deskTop;
    if (!d) return null;
    const origin = asset.anchors[ORIGIN.desk];
    if (!origin) return null;
    const m = asset.metresPerPx;
    const W = asset.width;
    const H = asset.height;
    const front = (x: number) => d.front[0] + d.front[1] * x;
    const floorFront = (x: number) => front(x) + 0.73 / m;
    const colourAt = (x: number) => {
      const cs = d.bottomColours;
      let a = cs[0];
      let b = cs[cs.length - 1];
      for (let i = 0; i < cs.length - 1; i++) if (x >= cs[i][0] && x <= cs[i + 1][0]) { a = cs[i]; b = cs[i + 1]; break; }
      const t = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
      return a[1].map((v, k) => (v + (b[1][k] - v) * t) / 255) as [number, number, number];
    };
    const pos: number[] = [];
    const col: number[] = [];
    const quad = (p: [number, number][], c: [number, number, number][]) => {
      const L = p.map((q) => toLocal(asset, q, origin));
      for (const k of [0, 1, 2, 0, 2, 3]) {
        pos.push(L[k][0], L[k][1], 0);
        col.push(...c[k].map((v) => Math.pow(v, 2.2)));
      }
    };
    const x0 = d.ends[0];
    const x1 = Math.min(d.ends[1], W - 1);
    const seg = 24;
    const shade = (c: [number, number, number], k: number) => c.map((v) => v * k) as [number, number, number];
    for (let i = 0; i < seg; i++) {
      const xa = x0 + ((x1 - x0) * i) / seg;
      const xb = x0 + ((x1 - x0) * (i + 1)) / seg;
      const ca = colourAt(xa);
      const cb = colourAt(xb);
      // desk top below the render's bottom edge, down to the front edge
      const ya = Math.max(H - 1, front(xa));
      const yb = Math.max(H - 1, front(xb));
      if (ya > H - 1 || yb > H - 1) quad([[xa, H - 1.5], [xb, H - 1.5], [xb, yb], [xa, ya]], [ca, cb, cb, ca]);
      // front edge: a thin lit lip, then the shaded edge band
      const lip = 4;
      const band = 0.03 / m;
      quad([[xa, ya], [xb, yb], [xb, yb + lip], [xa, ya + lip]], [shade(ca, 1.06), shade(cb, 1.06), shade(cb, 1.0), shade(ca, 1.0)]);
      quad([[xa, ya + lip], [xb, yb + lip], [xb, yb + band], [xa, ya + band]], [shade(ca, 0.78), shade(cb, 0.78), shade(cb, 0.72), shade(ca, 0.72)]);
      // a soft shadow line where the panel meets the edge band
      quad([[xa, ya + band], [xb, yb + band], [xb, yb + band + 6], [xa, ya + band + 6]], [shade(ca, 0.6), shade(cb, 0.6), shade(cb, 0.84), shade(ca, 0.84)]);
      // modesty panel (hides his legs and the chair base, as a real desk would)
      const pa = ya + band;
      const pb = yb + band;
      const inset = 0.05 / m;
      if (xa >= x0 + inset - 1 && xb <= x1 - inset + 1)
        quad([[xa, pa + 6], [xb, pb + 6], [xb, floorFront(xb) - 0.08 / m], [xa, floorFront(xa) - 0.08 / m]], [shade(ca, 0.84), shade(cb, 0.84), shade(cb, 0.74), shade(ca, 0.74)]);
    }
    // legs at both ends
    const leg: [number, number, number] = [0.2, 0.2, 0.22];
    const legW = 0.04 / m;
    for (const lx of [x0 + 0.012 / m, x1 - 0.012 / m - legW]) {
      const top = front(lx) + 0.03 / m;
      quad([[lx, top], [lx + legW, top], [lx + legW, floorFront(lx + legW)], [lx, floorFront(lx)]], [leg, leg, shade(leg, 0.8), shade(leg, 0.8)]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, [asset]);
}

function DeskSet({ asset }: { asset: PuppetAsset }) {
  const puppet = usePuppet(asset);
  const base = useDeskBase(asset);
  // transparent pass, so draw order (renderOrder) puts it in front of the walker like the rest of the set
  const baseMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }), []);
  const group = useRef<THREE.Group>(null);
  useEffect(() => {
    // chair behind the walker (renderOrder 10…), desk / seated character / mug in front of him
    const order: Record<string, number> = { chair: 6, desk: 20, person: 21, mug: 22 };
    for (const [name, mesh] of Object.entries(puppet.meshes)) mesh.renderOrder = order[name] ?? 20;
    return () => {
      base?.dispose();
      baseMat.dispose();
    };
  }, [puppet, base, baseMat]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const d = solved.deskSet;
    g.visible = d.show;
    if (!d.show) return;
    puppet.setPose(d.pose);
    puppet.meshes.person.visible = d.person;
    puppet.materials.person.opacity = d.personOpacity;
    g.position.copy(d.pos);
    g.scale.setScalar(d.scale);
  });
  return (
    <group ref={group} visible={false}>
      {base && <mesh geometry={base} material={baseMat} renderOrder={19} frustumCulled={false} />}
      <primitive object={puppet.group} />
    </group>
  );
}

/** Mounts puppets as the choreography requests them (rare state updates, never per frame). */
export function Puppets() {
  // the hero renders are mounted by HeroPuppetPreload (inside the scene's loading boundary)
  const [mounted, setMounted] = useState<PuppetId[]>([]);
  const ref = useRef(mounted);
  // Polled on a light timer, not in useFrame: the render loop sleeps while nothing is on
  // screen, and a fast jump down the page must still load the next scene's render.
  useEffect(() => {
    const check = () => {
      let next: PuppetId[] | null = null;
      for (const id of requestedPuppets) {
        if (HERO_PUPPETS.includes(id) || !getPuppet(id) || ref.current.includes(id) || next?.includes(id)) continue;
        next = [...(next ?? ref.current), id];
      }
      if (!next) return;
      ref.current = next;
      setMounted(next);
    };
    check();
    const id = window.setInterval(check, 200);
    return () => window.clearInterval(id);
  }, []);
  return (
    <>
      {mounted.map((id) => {
        const asset = getPuppet(id)!;
        return (
          <Suspense key={id} fallback={null}>
            {ACTORS.includes(id) ? <PuppetActor asset={asset} /> : <DeskSet asset={asset} />}
          </Suspense>
        );
      })}
    </>
  );
}

/** The hero's seated render must be ready before the scene reveals (no fallback pose at first paint). */
export function HeroPuppetPreload() {
  return (
    <>
      {HERO_PUPPETS.map((id) => {
        const asset = getPuppet(id);
        return asset ? <PuppetActor key={id} asset={asset} /> : null;
      })}
    </>
  );
}
