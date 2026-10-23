import { describe, expect, it } from "vitest";
import { seededRng } from "../src/engine/random";
import { awayFrom, chooseActivity, MIN_WALK, SULK_AFTER, walkTarget, type Area } from "../src/friend/brain";

const area: Area = { minX: 100, maxX: 600, minY: 900, maxY: 1200 };

describe("brain", () => {
  it("is reproducible for the same seed", () => {
    const run = () => {
      const rng = seededRng(7);
      return Array.from({ length: 20 }, () =>
        chooseActivity({ x: 300, y: 1000, area, idleFor: 0, last: null, rng }),
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
      const a = chooseActivity({ x: 300, y: 1000, area, idleFor: 5, last: null, rng });
      expect(a.kind).not.toBe("sulk");
    }
  });

  it("mostly sulks when ignored", () => {
    const rng = seededRng(4);
    const kinds = Array.from({ length: 300 }, () =>
      chooseActivity({ x: 300, y: 1000, area, idleFor: SULK_AFTER + 1, last: null, rng }).kind,
    );
    expect(kinds.filter((k) => k === "sulk").length).toBeGreaterThan(100);
  });

  it("storms off to the opposite side", () => {
    const rng = seededRng(5);
    for (let i = 0; i < 50; i++) {
      expect(awayFrom(150, { y: 1000, area, rng }).x).toBeGreaterThan(350);
      expect(awayFrom(550, { y: 1000, area, rng }).x).toBeLessThan(350);
    }
  });
});
