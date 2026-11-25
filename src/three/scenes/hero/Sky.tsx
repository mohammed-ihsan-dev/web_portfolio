'use client';

/**
 * Hero sky: gradient + two parallax cloud layers sampled from a pre-baked
 * texture, and a noise-threshold dissolve that breaks the sky apart into the
 * page white during the transition. One full-screen triangle; skipped
 * entirely once the dissolve completes.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { solved } from '../../director/director';
import { createCloudTarget, fullscreenTriangle } from './cloudTexture';

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D uClouds;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uParallax;
uniform float uDissolve;
uniform vec3 uTop, uMid, uLow, uHaze, uLight, uShade, uPage;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;

  vec3 col = mix(uLow, uMid, smoothstep(0.0, 0.55, uv.y));
  col = mix(col, uTop, smoothstep(0.48, 1.05, uv.y));
  col = mix(col, uHaze, (1.0 - smoothstep(0.0, 0.42, uv.y)) * 0.55 * smoothstep(0.15, 1.0, uv.x));

  vec2 p = vec2(uv.x * aspect, uv.y);

  // far layer: small, slow, mostly upper sky
  vec2 q1 = p * vec2(0.42, 0.62) + vec2(uTime * 0.0025, 0.0) + uParallax * 0.012;
  vec4 a = texture2D(uClouds, q1);
  float d1 = smoothstep(0.5, 0.7, a.r + (a.a - 0.5) * 0.3) * smoothstep(0.06, 0.5, uv.y) * 0.92;
  float s1 = clamp(0.55 + (a.r - a.g) * 7.0, 0.0, 1.0);
  col = mix(col, mix(uShade, uLight, s1), d1);

  // near layer: large, faster parallax, low in frame
  vec2 q2 = p * vec2(0.24, 0.36) + vec2(0.31 + uTime * 0.006, 0.47) + uParallax * 0.04;
  vec4 b = texture2D(uClouds, q2);
  float d2 = smoothstep(0.52, 0.74, b.r) * (1.0 - smoothstep(0.5, 0.98, uv.y)) * 0.96;
  float s2 = clamp(0.6 + (b.r - b.g) * 7.0, 0.0, 1.0);
  col = mix(col, mix(uShade, uLight, s2), d2);

  // dissolve into the page
  float dn = texture2D(uClouds, p * 0.55 + vec2(0.13, 0.71)).b * 0.86 + (1.0 - uv.y) * 0.14;
  float th = uDissolve * 1.3 - 0.14;
  float alpha = smoothstep(th - 0.045, th + 0.045, dn);
  float rim = smoothstep(th - 0.045, th, dn) * (1.0 - smoothstep(th, th + 0.1, dn));
  float toPage = clamp(uDissolve * 0.55 + rim * 0.9 * step(0.0005, uDissolve), 0.0, 1.0);
  col = mix(col, uPage, toPage);

  gl_FragColor = vec4(col * alpha, alpha);
}`;

const c = (hex: string) => new THREE.Color().setStyle(hex, THREE.NoColorSpace);

export function Sky() {
  const gl = useThree((s) => s.gl);
  const mesh = useRef<THREE.Mesh>(null);
  // 512² is plenty: the sky samples it at low frequency with mipmaps.
  const target = useMemo(() => createCloudTarget(gl, 512), [gl]);
  const geometry = useMemo(() => fullscreenTriangle(), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        depthTest: false,
        depthWrite: false,
        // Drawn first onto a cleared transparent buffer: write premultiplied colour directly.
        blending: THREE.NoBlending,
        uniforms: {
          uClouds: { value: target.texture },
          uRes: { value: new THREE.Vector2(1, 1) },
          uTime: { value: 0 },
          uParallax: { value: new THREE.Vector2() },
          uDissolve: { value: 0 },
          // Raw sRGB values so the final white matches the CSS page colour exactly.
          uTop: { value: c('#6d92c8') },
          uMid: { value: c('#a8c0e2') },
          uLow: { value: c('#ebe6ec') },
          uHaze: { value: c('#f2e1e2') },
          uLight: { value: c('#ffffff') },
          uShade: { value: c('#b6c1d8') },
          uPage: { value: c('#fbfbf9') },
        },
      }),
    [target],
  );

  useEffect(
    () => () => {
      target.dispose();
      material.dispose();
      geometry.dispose();
    },
    [target, material, geometry],
  );

  useFrame((state, dt) => {
    const m = mesh.current;
    if (!m) return;
    const h = solved.hero;
    m.visible = h.show && h.dissolve < 1;
    if (!m.visible) return;
    const u = material.uniforms;
    u.uTime.value += Math.min(dt, 0.1);
    u.uDissolve.value = h.dissolve;
    (u.uParallax.value as THREE.Vector2).copy(solved.parallax);
    (u.uRes.value as THREE.Vector2).set(state.size.width, state.size.height);
  });

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={-100} />;
}
