// Pure terrain math — no React, no three.js.
export const WATER_LEVEL = 0;
export const SAND_LEVEL = 0.45;

export interface Lake {
  id: string;
  x: number;
  z: number;
  r: number;
  level: number;
}

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
export function noise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = smooth(x - xi), zf = smooth(z - zi);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}
export function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return smooth(t);
}

/** Height of the island without lakes. */
export function baseHeight(x: number, z: number) {
  const ang = Math.atan2(z, x);
  const R = 13 + 2.4 * Math.sin(3 * ang) + 1.4 * Math.cos(5 * ang + 1) + 1.2 * (noise(x * 0.15, z * 0.15) - 0.5);
  const d = Math.sqrt(x * x + z * z) / R;
  const land = 1 - smoothstep(0.5, 1.12, d);
  const hills = Math.max(0, noise(x * 0.16 + 7, z * 0.16 + 3) - 0.45) * 5;
  return -1.8 + land * (2.6 + noise(x * 0.3, z * 0.3) * 0.5 + hills * land);
}

export function heightAt(x: number, z: number, lakes: Lake[]) {
  let h = baseHeight(x, z);
  for (const l of lakes) {
    const d = Math.hypot(x - l.x, z - l.z);
    const t = 1 - smoothstep(l.r * 0.5, l.r + 0.8, d);
    if (t > 0) h = Math.min(h, h * (1 - t) + (l.level - 0.6) * t);
  }
  return h;
}

export function inLake(x: number, z: number, lakes: Lake[], pad = 0) {
  return lakes.some((l) => Math.hypot(x - l.x, z - l.z) < l.r + pad);
}
