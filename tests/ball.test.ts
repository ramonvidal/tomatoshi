import { describe, expect, it } from "vitest";
import { stepBall, type BallBody } from "../src/objects/ball";

const area = { minX: 0, maxX: 600, minY: 900, maxY: 1200 };

function simulate(start: BallBody, seconds: number): BallBody {
  let b = start;
  for (let t = 0; t < seconds; t += 1 / 60) b = stepBall(b, area, 1 / 60);
  return b;
}

describe("ball physics", () => {
  it("comes to rest on the ground after a throw", () => {
    const end = simulate({ x: 300, y: 1000, h: 0, vx: 900, vy: 300, vh: 800 }, 10);
    expect(end).toMatchObject({ h: 0, vx: 0, vy: 0, vh: 0 });
  });

  it("stays inside the area, bouncing off its edges", () => {
    let b: BallBody = { x: 550, y: 1150, h: 0, vx: 1500, vy: 800, vh: 0 };
    for (let i = 0; i < 600; i++) {
      b = stepBall(b, area, 1 / 60);
      expect(b.x).toBeGreaterThanOrEqual(area.minX);
      expect(b.x).toBeLessThanOrEqual(area.maxX);
      expect(b.y).toBeGreaterThanOrEqual(area.minY);
      expect(b.y).toBeLessThanOrEqual(area.maxY);
    }
  });

  it("never sinks below the floor", () => {
    let b: BallBody = { x: 300, y: 1000, h: 400, vx: 0, vy: 0, vh: -2000 };
    for (let i = 0; i < 300; i++) {
      b = stepBall(b, area, 1 / 30);
      expect(b.h).toBeGreaterThanOrEqual(0);
    }
  });
});
