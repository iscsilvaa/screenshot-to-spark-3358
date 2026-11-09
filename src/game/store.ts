import { useSyncExternalStore } from "react";
import { baseHeight, inLake, SAND_LEVEL, type Lake } from "./terrain";

export type ObjKind = "tree" | "palm" | "rock" | "house" | "animal";
export type Tool = "tree" | "rock" | "house" | "lake" | "animal" | "remove" | null;

export interface WorldObject {
  id: string;
  kind: ObjKind;
  x: number;
  z: number;
  rot: number;
  scale: number;
  variant: number;
}

export interface Resources {
  coins: number;
  wood: number;
  stone: number;
}

export interface GameState {
  objects: WorldObject[];
  lakes: Lake[];
  resources: Resources;
  xp: number;
  tool: Tool;
  message: string | null;
}

export const COSTS: Record<Exclude<Tool, null | "remove">, Partial<Resources>> = {
  tree: { coins: 3 },
  rock: { coins: 2 },
  house: { wood: 8, stone: 4 },
  lake: { coins: 10 },
  animal: { coins: 6 },
};
export const XP_GAIN = { tree: 5, rock: 3, house: 20, lake: 12, animal: 10, remove: 2 };

export function levelFromXp(xp: number) {
  let level = 1, need = 50, acc = 0;
  while (xp >= acc + need) {
    acc += need;
    level++;
    need = Math.round(need * 1.4);
  }
  return { level, progress: (xp - acc) / need, into: xp - acc, need };
}

let uid = 0;
const id = () => `o${Date.now().toString(36)}${(uid++).toString(36)}`;

function seed(): GameState {
  const lakes: Lake[] = [{ id: "lake0", x: 3.5, z: 2, r: 2.2, level: baseHeight(3.5, 2) - 0.25 }];
  const objects: WorldObject[] = [];
  let s = 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 400 && objects.length < 46; i++) {
    const x = (rnd() - 0.5) * 30, z = (rnd() - 0.5) * 30;
    const h = baseHeight(x, z);
    if (h < SAND_LEVEL - 0.15 || inLake(x, z, lakes, 1) || objects.some((o) => Math.hypot(o.x - x, o.z - z) < 1.4)) continue;
    const onSand = h < SAND_LEVEL + 0.25;
    const kind: ObjKind = onSand ? "palm" : rnd() < 0.22 ? "rock" : rnd() < 0.5 ? "palm" : "tree";
    objects.push({ id: id(), kind, x, z, rot: rnd() * Math.PI * 2, scale: 0.8 + rnd() * 0.5, variant: Math.floor(rnd() * 3) });
  }
  objects.push({ id: id(), kind: "house", x: -2, z: -1, rot: 0.4, scale: 1, variant: 0 });
  objects.push({ id: id(), kind: "animal", x: -1, z: 2, rot: 0, scale: 1, variant: 0 });
  objects.push({ id: id(), kind: "animal", x: 0.5, z: -3, rot: 0, scale: 1, variant: 1 });
  return { objects, lakes, resources: { coins: 30, wood: 12, stone: 6 }, xp: 0, tool: null, message: null };
}

let state: GameState = seed();
const listeners = new Set<() => void>();
function set(patch: Partial<GameState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const getState = () => state;
export function useGame<T>(sel: (s: GameState) => T): T {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => sel(state),
    () => sel(state),
  );
}

let msgTimer: ReturnType<typeof setTimeout> | undefined;
function flash(message: string) {
  set({ message });
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => set({ message: null }), 1800);
}

function canAfford(cost: Partial<Resources>) {
  return (Object.keys(cost) as (keyof Resources)[]).every((k) => state.resources[k] >= (cost[k] ?? 0));
}
function pay(cost: Partial<Resources>, gain: Partial<Resources> = {}) {
  const r = { ...state.resources };
  for (const k of Object.keys(r) as (keyof Resources)[]) r[k] += (gain[k] ?? 0) - (cost[k] ?? 0);
  return r;
}

export function setTool(tool: Tool) {
  set({ tool: state.tool === tool ? null : tool });
}

/** Validates a position for the given tool. Returns an error string or null. */
export function validate(tool: Tool, x: number, z: number): string | null {
  if (!tool || tool === "remove") return null;
  const h = baseHeight(x, z);
  if (h < SAND_LEVEL - 0.1) return "Precisa ser em terra firme";
  const pad = tool === "lake" ? 2.6 : 0.3;
  if (inLake(x, z, state.lakes, pad)) return "Muito perto da água";
  const minDist = tool === "lake" ? 2.6 : tool === "house" ? 1.6 : tool === "animal" ? 0 : 1;
  if (minDist && state.objects.some((o) => o.kind !== "animal" && Math.hypot(o.x - x, o.z - z) < minDist))
    return "Espaço ocupado";
  if (tool === "lake" && h < SAND_LEVEL + 0.5) return "Lagos precisam de solo mais alto";
  return null;
}

export function placeAt(x: number, z: number) {
  console.log("place", x, z, state.tool);
  const tool = state.tool;
  if (!tool || tool === "remove") return;
  x = Math.round(x * 2) / 2;
  z = Math.round(z * 2) / 2;
  const err = validate(tool, x, z);
  if (err) return flash(err);
  const cost = COSTS[tool];
  if (!canAfford(cost)) return flash("Recursos insuficientes");
  const xp = state.xp + XP_GAIN[tool as keyof typeof XP_GAIN];
  if (tool === "lake") {
    const r = 1.6;
    set({
      lakes: [...state.lakes, { id: id(), x, z, r, level: baseHeight(x, z) - 0.25 }],
      objects: state.objects.filter((o) => Math.hypot(o.x - x, o.z - z) > r + 0.4),
      resources: pay(cost),
      xp,
    });
    return;
  }
  const kind: ObjKind = tool === "tree" ? (Math.random() < 0.5 ? "palm" : "tree") : tool;
  set({
    objects: [
      ...state.objects,
      { id: id(), kind, x, z, rot: Math.random() * Math.PI * 2, scale: 0.85 + Math.random() * 0.35, variant: Math.floor(Math.random() * 3) },
    ],
    resources: pay(cost),
    xp,
  });
}

export function removeObject(oid: string) {
  const o = state.objects.find((x) => x.id === oid);
  if (!o) return;
  const gain: Partial<Resources> =
    o.kind === "tree" || o.kind === "palm" ? { wood: 3 } : o.kind === "rock" ? { stone: 2 } : o.kind === "house" ? { wood: 4, stone: 2 } : { coins: 3 };
  set({ objects: state.objects.filter((x) => x.id !== oid), resources: pay({}, gain), xp: state.xp + XP_GAIN.remove });
}

/** Passive income: called by the HUD on an interval. */
export function tickIncome() {
  const houses = state.objects.filter((o) => o.kind === "house").length;
  const animals = state.objects.filter((o) => o.kind === "animal").length;
  set({ resources: pay({}, { coins: 1 + houses + Math.floor(animals / 2) }) });
}

/** Serializable snapshot — ready to be stored in a Lovable Cloud table later. */
export function snapshot() {
  const { objects, lakes, resources, xp } = state;
  return { objects, lakes, resources, xp };
}
export function loadSnapshot(s: ReturnType<typeof snapshot>) {
  set({ ...s, tool: null });
}
