export const clamp = (v: number, min = 0, max = 1) => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Map `v` from [a, b] to [0, 1], clamped. The workhorse for scroll choreography. */
export const range = (v: number, a: number, b: number) => clamp((v - a) / (b - a));

export const smoothstep = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;

/** Frame-rate independent exponential smoothing. `lambda` ~ responsiveness (1/s). */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Shortest-path angle damping (radians). */
export const dampAngle = (current: number, target: number, lambda: number, dt: number) => {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-lambda * dt));
};
