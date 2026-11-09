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

/**
 * Expansion milestones. `area` is total area relative to the original island.
 * Add entries here for future levels (20, 25, 30...).
 */
export const EXPANSION_AREAS = [1, 1.3, 1.6, 2.0];
/** Mountain + waterfall region appears with expansion index 2 (level 10). */
export const MOUNTAIN = { x: -9, z: -9, height: 5.5, sigma: 3.0, stage: 2 };

/** Radius multiplier for a (possibly fractional, animating) expansion value. */
export function radiusScale(e: number) {
  const max = EXPANSION_AREAS.length - 1;
  const c = Math.max(0, Math.min(max, e));
  const i = Math.min(max - 1, Math.floor(c));
  const t = c - i;
  const a = EXPANSION_AREAS[i]! + (EXPANSION_AREAS[i + 1]! - EXPANSION_AREAS[i]!) * t;
  return Math.sqrt(a);
}

/** Height of the island without lakes, for expansion value `e` (0 = original island). */
export function baseHeight(x: number, z: number, e = 0) {
  const ang = Math.atan2(z, x);
  const k = radiusScale(e);
  // Later expansions add irregular lobes so new land isn't a uniform scale-up.
  const lobes = Math.max(0, e - 2) * (1.4 * Math.sin(2 * ang + 0.7) + 0.9 * Math.cos(4 * ang - 0.3));
  const R = lobes + k * (13 + 2.4 * Math.sin(3 * ang) + 1.4 * Math.cos(5 * ang + 1) + 1.2 * (noise(x * 0.15, z * 0.15) - 0.5);
  const d = Math.sqrt(x * x + z * z) / R;
  const land = 1 - smoothstep(0.5, 1.12, d);
  const hills = Math.max(0, noise(x * 0.16 + 7, z * 0.16 + 3) - 0.45) * 5;
  let h = -1.8 + land * (2.6 + noise(x * 0.3, z * 0.3) * 0.5 + hills * land);
  const m = Math.max(0, Math.min(1, e - (MOUNTAIN.stage - 1)));
  if (m > 0) {
    const d2 = (x - MOUNTAIN.x) ** 2 + (z - MOUNTAIN.z) ** 2;
    const peak = m * MOUNTAIN.height * Math.exp(-d2 / (2 * MOUNTAIN.sigma ** 2));
    h += peak * (1 + 0.25 * (noise(x * 0.8, z * 0.8) - 0.5));
  }
  return h;
}

export function heightAt(x: number, z: number, lakes: Lake[], e = 0) {
  let h = baseHeight(x, z, e);
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
