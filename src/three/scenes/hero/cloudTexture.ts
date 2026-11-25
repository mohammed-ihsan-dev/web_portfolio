/**
 * Renders a tileable cloud field ONCE into a texture, so the per-frame sky is
 * a handful of texture reads instead of full-screen FBM.
 *   R: cumulus density (domain-warped FBM)
 *   G: density sampled toward the sun (R - G = self-shading)
 *   B: dissolve noise for the hero exit
 *   A: soft wisp layer
 */
import * as THREE from 'three';

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const fragment = /* glsl */ `
precision highp float;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
// Periodic value noise: integer period keeps the texture seamless.
float pnoise(vec2 p, float per) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(mod(i, per));
  float b = hash(mod(i + vec2(1.0, 0.0), per));
  float c = hash(mod(i + vec2(0.0, 1.0), per));
  float d = hash(mod(i + vec2(1.0, 1.0), per));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float pfbm(vec2 uv, float freq, int octaves, float seed) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 7; i++) {
    if (i >= octaves) break;
    sum += amp * pnoise(uv * freq + seed, freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return sum;
}

void main() {
  vec2 uv = vUv;
  vec2 w = vec2(pfbm(uv, 4.0, 4, 1.0), pfbm(uv, 4.0, 4, 7.0)) - 0.5;
  vec2 cu = uv + w * 0.14;
  float d = pfbm(cu, 5.0, 6, 0.0);
  float dl = pfbm(cu + vec2(-0.0055, 0.011), 5.0, 6, 0.0);
  float diss = pfbm(uv, 6.0, 4, 3.0);
  float wisp = pfbm(uv + w * 0.25, 3.0, 5, 5.0);
  gl_FragColor = vec4(d, dl, diss, wisp);
}`;

export function createCloudTarget(renderer: THREE.WebGLRenderer, size = 1024): THREE.WebGLRenderTarget {
  const floatOk = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const target = new THREE.WebGLRenderTarget(size, size, {
    type: floatOk ? THREE.HalfFloatType : THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    depthBuffer: false,
    colorSpace: THREE.NoColorSpace,
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, depthTest: false, depthWrite: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const prevTarget = renderer.getRenderTarget();
  const prevAutoClear = renderer.autoClear;
  renderer.autoClear = true;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(prevTarget);
  renderer.autoClear = prevAutoClear;

  geometry.dispose();
  material.dispose();
  return target;
}

/** Shared full-screen triangle (clip-space positions). */
export function fullscreenTriangle() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return g;
}
