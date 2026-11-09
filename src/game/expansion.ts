// Pure expansion rules — no React, no three.js.
import { baseHeight, EXPANSION_AREAS, inLake, MOUNTAIN, SAND_LEVEL, type Lake } from "./terrain";

export interface ExpansionStage {
  level: number;
  title: string;
  features: string[];
}

/** Index i here unlocks EXPANSION_AREAS[i + 1]. Add levels 20/25/30 by appending to both lists. */
export const EXPANSIONS: ExpansionStage[] = [
  { level: 5, title: "Primeira expansão", features: ["Praias ampliadas", "Novas florestas", "Espaço para construir"] },
  { level: 10, title: "Segunda expansão", features: ["Região montanhosa", "Cachoeira", "Novo lago e habitats"] },
  { level: 15, title: "Terceira expansão", features: ["Novas praias e campos", "Floresta densa", "Terreno para a futura vila"] },
].slice(0, EXPANSION_AREAS.length - 1);

export function expansionsForLevel(level: number) {
  return EXPANSIONS.filter((s) => s.level <= level).length;
}

export interface SpawnObj {
  kind: "tree" | "palm" | "rock" | "animal";
  x: number;
  z: number;
  rot: number;
  scale: number;
  variant: number;
}

/** Content that appears with expansion `index` (1-based). Deterministic. */
export function generateExpansion(
  index: number,
  existing: { x: number; z: number }[],
  lakes: Lake[],
): { objects: SpawnObj[]; lakes: Omit<Lake, "id">[] } {
  let s = 977 * index + 13;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const taken = existing.map((o) => ({ x: o.x, z: o.z }));
  const newLakes: Omit<Lake, "id">[] = [];
  const allLakes = () => [...lakes, ...(newLakes as Lake[])];
  const free = (x: number, z: number, d: number) =>
    !inLake(x, z, allLakes(), 0.8) && !taken.some((o) => Math.hypot(o.x - x, o.z - z) < d);
  const isNewLand = (x: number, z: number) =>
    baseHeight(x, z, index - 1) < SAND_LEVEL && baseHeight(x, z, index) >= SAND_LEVEL;

  const objects: SpawnObj[] = [];
  const add = (kind: SpawnObj["kind"], x: number, z: number) => {
    x = Math.round(x * 2) / 2;
    z = Math.round(z * 2) / 2;
    objects.push({ kind, x, z, rot: rnd() * Math.PI * 2, scale: 0.8 + rnd() * 0.5, variant: Math.floor(rnd() * 3) });
    taken.push({ x, z });
  };
  const scatter = (count: number, test: (x: number, z: number, h: number) => boolean, pick: (h: number) => SpawnObj["kind"], gap = 1.3, span = 46) => {
    for (let i = 0, n = 0; i < 3000 && n < count; i++) {
      const x = (rnd() - 0.5) * span, z = (rnd() - 0.5) * span;
      const h = baseHeight(x, z, index);
      if (h < SAND_LEVEL - 0.1 || !test(x, z, h) || !free(x, z, gap)) continue;
      add(pick(h), x, z);
      n++;
    }
  };

  if (index === 1) {
    // Wider beaches with palms, new forest patches on the new ring.
    scatter(14, (x, z) => isNewLand(x, z), (h) => (h < SAND_LEVEL + 0.3 ? "palm" : rnd() < 0.7 ? "tree" : "palm"));
    scatter(3, (x, z) => isNewLand(x, z), () => "rock", 2);
  } else if (index === 2) {
    // Lake at the foot of the mountain, fed by the waterfall.
    let best: [number, number] | null = null;
    for (let t = 0; t < 40 && !best; t++) {
      const a = Math.PI * 0.25 + (rnd() - 0.5) * 0.9;
      const d = 4.2 + rnd() * 1.5;
      const x = Math.round((MOUNTAIN.x + Math.cos(a) * d) * 2) / 2, z = Math.round((MOUNTAIN.z + Math.sin(a) * d) * 2) / 2;
      if (baseHeight(x, z, index) > SAND_LEVEL + 0.4 && !taken.some((o) => Math.hypot(o.x - x, o.z - z) < 2.4) && !inLake(x, z, lakes, 3))
        best = [x, z];
    }
    if (best) newLakes.push({ x: best[0], z: best[1], r: 1.5, level: baseHeight(best[0], best[1], index) - 0.25 });
    scatter(5, (x, z) => Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z) < 5, () => "rock", 1.6);
    scatter(8, (x, z) => isNewLand(x, z) || Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z) < 6, () => (rnd() < 0.8 ? "tree" : "palm"));
    scatter(4, (x, z, h) => h > SAND_LEVEL + 0.3 && Math.hypot(x, z) < 12, () => "animal", 1, 24);
  } else {
    // Dense forest on the eastern new land, palms on new beaches; leave open meadow for a village.
    const fx = 14, fz = -6;
    scatter(26, (x, z) => Math.hypot(x - fx, z - fz) < 6, () => (rnd() < 0.85 ? "tree" : "palm"), 0.95);
    scatter(10, (x, z, h) => isNewLand(x, z) && h < SAND_LEVEL + 0.35 && Math.hypot(x - fx, z - fz) > 6, () => "palm");
    scatter(3, (x, z) => isNewLand(x, z), () => "animal", 1);
  }
  return { objects, lakes: newLakes };
}
