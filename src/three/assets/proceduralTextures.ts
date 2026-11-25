/**
 * Small procedural textures (no downloads): a code-editor screen for the
 * laptop/monitor and a soft blob shadow. Created once, shared, disposed with
 * the canvas.
 */
import * as THREE from 'three';

let screenTex: THREE.CanvasTexture | null = null;
let shadowTex: THREE.CanvasTexture | null = null;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function getScreenTexture(): THREE.CanvasTexture {
  if (screenTex) return screenTex;
  const w = 640;
  const h = 400;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#14161b';
  ctx.fillRect(0, 0, w, h);
  // editor chrome
  ctx.fillStyle = '#1b1e25';
  ctx.fillRect(0, 0, 120, h);
  ctx.fillRect(0, 0, w, 26);
  ['#ff6b5e', '#f7c34c', '#5fc957'].forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(14 + i * 14, 13, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  const rand = seeded(7);
  // file tree
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i === 4 ? '#e4edb4' : 'rgba(255,255,255,0.22)';
    ctx.fillRect(16 + (i % 3) * 8, 44 + i * 20, 40 + rand() * 46, 5);
  }
  // code lines
  const palette = ['#e4edb4', '#9bb7e8', 'rgba(255,255,255,0.75)', '#e6a3c4', 'rgba(255,255,255,0.4)'];
  let y = 46;
  let indent = 0;
  while (y < h - 14) {
    if (rand() > 0.82) {
      y += 14;
      indent = Math.max(0, indent + (rand() > 0.5 ? 1 : -1));
      continue;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(132, y, 10, 5);
    let x = 156 + indent * 18;
    const tokens = 1 + Math.floor(rand() * 4);
    for (let t = 0; t < tokens; t++) {
      const len = 16 + rand() * 70;
      ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
      ctx.fillRect(x, y, len, 5);
      x += len + 8;
    }
    y += 14;
  }
  screenTex = new THREE.CanvasTexture(canvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = 4;
  return screenTex;
}

export function getShadowTexture(): THREE.CanvasTexture {
  if (shadowTex) return shadowTex;
  const s = 128;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  shadowTex = new THREE.CanvasTexture(canvas);
  return shadowTex;
}

export function disposeProceduralTextures() {
  screenTex?.dispose();
  shadowTex?.dispose();
  screenTex = null;
  shadowTex = null;
}
