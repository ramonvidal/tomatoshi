import { describe, expect, it } from "vitest";
import { seededRng } from "../src/engine/random";
import { awayFrom, chooseActivity, MIN_WALK, SULK_AFTER, walkTarget, weighOpportunities, type Area } from "../src/friend/brain";
import { DEFAULT_NEEDS } from "../src/friend/needs";

const area: Area = { minX: 100, maxX: 600, minY: 900, maxY: 1200 };

describe("brain", () => {
  it("is reproducible for the same seed", () => {
    const run = () => {
      const rng = seededRng(7);
      return Array.from({ length: 20 }, () =>
        chooseActivity({ x: 300, y: 1000, area, idleFor: 0, last: null, opportunities: [], rng }),
      );
    };
    expect(run()).toEqual(run());
  });

  it("only walks to points inside the area, worth the trip", () => {
    const rng = seededRng(1);
    for (let i = 0; i < 200; i++) {
      const p = walkTarget({ x: 350, y: 1050, area, rng });
      expect(p.x).toBeGreaterThanOrEqual(area.minX);
      expect(p.x).toBeLessThanOrEqual(area.maxX);
      expect(p.y).toBeGreaterThanOrEqual(area.minY);
      expect(p.y).toBeLessThanOrEqual(area.maxY);
      expect(Math.hypot(p.x - 350, p.y - 1050)).toBeGreaterThanOrEqual(MIN_WALK);
    }
  });

  it("never sulks while someone is paying attention", () => {
    const rng = seededRng(3);
    for (let i = 0; i < 300; i++) {
      const a = chooseActivity({ x: 300, y: 1000, area, idleFor: 5, last: null, opportunities: [], rng });
      expect(a.kind).not.toBe("sulk");
    }
  });

  it("mostly sulks when ignored", () => {
    const rng = seededRng(4);
    const kinds = Array.from({ length: 300 }, () =>
      chooseActivity({ x: 300, y: 1000, area, idleFor: SULK_AFTER + 1, last: null, opportunities: [], rng }).kind,
    );
    expect(kinds.filter((k) => k === "sulk").length).toBeGreaterThan(100);
  });

  it("never uses objects when nothing is on offer", () => {
    const rng = seededRng(6);
    for (let i = 0; i < 300; i++) {
      expect(chooseActivity({ x: 300, y: 1000, area, idleFor: 0, last: null, opportunities: [], rng }).kind).not.toBe("use");
    }
  });

  it("picks objects in proportion to how much it wants them", () => {
    const rng = seededRng(8);
    const opportunities = [
      { propId: "couch", action: "nap" as const, weight: 30 },
      { propId: "ball", action: "kick" as const, weight: 0 },
    ];
    const tired = { ...DEFAULT_NEEDS, energy: 10 };
    const picks = Array.from({ length: 300 }, () =>
      chooseActivity({ x: 300, y: 1000, area, idleFor: 0, last: null, opportunities, needs: tired, rng }),
    );
    const uses = picks.filter((a) => a.kind === "use");
    // A strong pull (like sleepiness in the dark) wins most of the time…
    expect(uses.length).toBeGreaterThan(200);
    // …and zero-weight options are never chosen.
    expect(uses.every((a) => a.kind === "use" && a.propId === "couch" && a.action === "nap")).toBe(true);
  });

  it("weighs what objects offer by how much it needs them", () => {
    const offers = [
      { propId: "bowl", action: "eat" as const, weight: 1 },
      { propId: "ball", action: "kick" as const, weight: 1 },
    ];
    const hungry = weighOpportunities(offers, { ...DEFAULT_NEEDS, fullness: 5, fun: 95 });
    expect(hungry[0].weight).toBeGreaterThan(hungry[1].weight * 5);
    const bored = weighOpportunities(offers, { ...DEFAULT_NEEDS, fullness: 95, fun: 5 });
    expect(bored[1].weight).toBeGreaterThan(bored[0].weight * 5);
  });

  it("asks for snacks when hungry", () => {
    const rng = seededRng(10);
    const hungry = { ...DEFAULT_NEEDS, fullness: 10 };
    const symbols = Array.from({ length: 400 }, () =>
      chooseActivity({ x: 300, y: 1000, area, idleFor: 0, last: null, opportunities: [], needs: hungry, rng }),
    ).flatMap((a) => (a.kind === "mutter" ? [a.symbol] : []));
    expect(symbols.filter((s) => s === "snack").length).toBeGreaterThan(symbols.length / 2);
  });

  it("sulks when lonely even if someone was just around", () => {
    const rng = seededRng(11);
    const lonely = { ...DEFAULT_NEEDS, affection: 5 };
    const kinds = Array.from({ length: 300 }, () =>
      chooseActivity({ x: 300, y: 1000, area, idleFor: 0, last: null, opportunities: [], needs: lonely, rng }).kind,
    );
    expect(kinds).toContain("sulk");
  });

  it("never picks walk targets in places it avoids", () => {
    const rng = seededRng(12);
    const avoid = (p: { x: number; y: number }) => p.y < 1000; // the whole back of the room
    for (let i = 0; i < 200; i++) {
      expect(walkTarget({ x: 350, y: 1100, area, rng, avoid }).y).toBeGreaterThanOrEqual(1000);
    }
  });

  it("storms off to the opposite side", () => {
    const rng = seededRng(5);
    for (let i = 0; i < 50; i++) {
      expect(awayFrom(150, { y: 1000, area, rng }).x).toBeGreaterThan(350);
      expect(awayFrom(550, { y: 1000, area, rng }).x).toBeLessThan(350);
    }
  });
});
