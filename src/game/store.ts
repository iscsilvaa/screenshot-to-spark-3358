import { useSyncExternalStore } from "react";
import { baseHeight as rawHeight, inLake, SAND_LEVEL, type Lake } from "./terrain";
import { EXPANSIONS, expansionsForLevel, generateExpansion, type ExpansionStage } from "./expansion";

/** Height using the player's unlocked territory. */
let curExpansion = 0;
const baseHeight = (x: number, z: number) => rawHeight(x, z, curExpansion);

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
}

export type Buildable = Exclude<Tool, null | "remove">;
export type Prices = Record<Buildable, number>;
export const DEFAULT_PRICES: Prices = { tree: 3, rock: 2, house: 15, lake: 10, animal: 6 };
/** Fraction of an object's price refunded when removed. */
export const REFUND = 0.5;

export interface GameState {
  objects: WorldObject[];
  lakes: Lake[];
  resources: Resources;
  xp: number;
  tool: Tool;
  message: string | null;
  /** Number of expansions unlocked (persisted). */
  expansion: number;
  /** Set when an expansion was just unlocked; drives the celebration UI. */
  celebration: (ExpansionStage & { index: number }) | null;
  sound: boolean;
  prices: Prices;
}

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
  return { objects, lakes, resources: { coins: 30 }, xp: 0, tool: null, message: null, expansion: 0, celebration: null, sound: true, prices: { ...DEFAULT_PRICES } };
}

let state: GameState = seed();
const listeners = new Set<() => void>();
function set(patch: Partial<GameState>) {
  state = { ...state, ...patch };
  curExpansion = state.expansion;
  listeners.forEach((l) => l());
  if (patch.xp !== undefined) checkExpansion(true);
}

/** Unlocks any expansions the current level has earned. Each happens exactly once. */
export function checkExpansion(celebrate: boolean) {
  const target = expansionsForLevel(levelFromXp(state.xp).level);
  while (state.expansion < target) {
    const index = state.expansion + 1;
    const gen = generateExpansion(index, state.objects, state.lakes);
    set({
      expansion: index,
      objects: [...state.objects, ...gen.objects.map((o) => ({ ...o, id: id() }))],
      lakes: [...state.lakes, ...gen.lakes.map((l) => ({ ...l, id: id() }))],
      celebration: celebrate ? { ...EXPANSIONS[index - 1]!, index } : state.celebration,
    });
  }
}
export function dismissCelebration() {
  set({ celebration: null });
}
export function toggleSound() {
  set({ sound: !state.sound });
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

const pay = (cost: number, gain = 0): Resources => ({ coins: state.resources.coins + gain - cost });

export function setPrice(tool: Buildable, price: number) {
  set({ prices: { ...state.prices, [tool]: Math.max(0, Math.round(price) || 0) } });
}
export function resetPrices() {
  set({ prices: { ...DEFAULT_PRICES } });
}
/** Starts a brand new island. Keeps the player's price settings and sound choice. */
export function resetGame() {
  const { prices, sound } = state;
  set({ ...seed(), prices, sound });
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
  const tool = state.tool;
  if (!tool || tool === "remove") return;
  x = Math.round(x * 2) / 2;
  z = Math.round(z * 2) / 2;
  const err = validate(tool, x, z);
  if (err) return flash(err);
  const cost = state.prices[tool];
  if (state.resources.coins < cost) return flash("Moedas insuficientes");
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
  const kind: Buildable = o.kind === "palm" ? "tree" : o.kind;
  const gain = Math.floor(state.prices[kind] * REFUND);
  set({ objects: state.objects.filter((x) => x.id !== oid), resources: pay(0, gain), xp: state.xp + XP_GAIN.remove });
}

/** Passive income: called by the HUD on an interval. */
export function tickIncome() {
  const houses = state.objects.filter((o) => o.kind === "house").length;
  const animals = state.objects.filter((o) => o.kind === "animal").length;
  set({ resources: pay(0, 1 + houses + Math.floor(animals / 2)) });
}

/** Serializable snapshot — ready to be stored in a Lovable Cloud table later. */
export function snapshot() {
  const { objects, lakes, resources, xp, expansion, prices } = state;
  return { objects, lakes, resources, xp, expansion, prices };
}
export function loadSnapshot(s: Partial<ReturnType<typeof snapshot>>) {
  state = { ...state, ...s, resources: { coins: s.resources?.coins ?? 30 }, prices: { ...DEFAULT_PRICES, ...s.prices }, expansion: s.expansion ?? 0, tool: null, celebration: null };
  curExpansion = state.expansion;
  // Rebuild any regions the saved level has earned (older saves), silently.
  checkExpansion(false);
  listeners.forEach((l) => l());
}
