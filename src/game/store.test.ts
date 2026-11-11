import { describe, it, expect } from "vitest";
import { getState, placeAt, removeObject, setTool, validate } from "./store";
import { baseHeight } from "./terrain";

function freeSpot(tool: "tree" | "house") {
  for (let x = -8; x <= 8; x += 0.5)
    for (let z = -8; z <= 8; z += 0.5) if (baseHeight(x, z) > 1 && !validate(tool, x, z)) return [x, z] as const;
  throw new Error("no spot");
}

describe("island rules", () => {
  it("planting a tree costs 3 coins and adds a tree", () => {
    const before = getState();
    const [x, z] = freeSpot("tree");
    setTool("tree");
    placeAt(x, z);
    const s = getState();
    expect(s.resources.coins).toBe(before.resources.coins - 3);
    expect(s.objects.length).toBe(before.objects.length + 1);
  });
  it("building a house costs only coins (15 by default)", () => {
    const before = getState().resources.coins;
    const [x, z] = freeSpot("house");
    setTool("house");
    placeAt(x, z);
    expect(getState().resources.coins).toBe(before - 15);
  });
  it("removing a tree refunds half its price in coins", () => {
    const t = getState().objects.find((o) => o.kind === "tree" || o.kind === "palm")!;
    const coins = getState().resources.coins;
    removeObject(t.id);
    expect(getState().resources.coins).toBe(coins + 1);
  });
  it("cannot build in the ocean", () => {
    expect(validate("house", 30, 30)).not.toBeNull();
  });
});

describe("island expansion", () => {
  it("reaching level 5 unlocks exactly one expansion, without removing objects", async () => {
    const { loadSnapshot, levelFromXp } = await import("./store");
    const before = getState().objects.length;
    let xp = 0;
    while (levelFromXp(xp).level < 5) xp++;
    loadSnapshot({ ...getState(), xp, expansion: 0 });
    expect(getState().expansion).toBe(1);
    expect(getState().objects.length).toBeGreaterThan(before);
  });
});

describe("prices and reset", () => {
  it("a custom price is charged", async () => {
    const { setPrice, resetGame } = await import("./store");
    resetGame();
    setPrice("tree", 7);
    const before = getState().resources.coins;
    const [x, z] = freeSpot("tree");
    setTool("tree");
    placeAt(x, z);
    expect(getState().resources.coins).toBe(before - 7);
  });
  it("reset returns to 30 coins, level 0 xp, keeps prices", async () => {
    const { resetGame } = await import("./store");
    resetGame();
    expect(getState().resources.coins).toBe(30);
    expect(getState().xp).toBe(0);
    expect(getState().expansion).toBe(0);
    expect(getState().prices.tree).toBe(7);
  });
});
