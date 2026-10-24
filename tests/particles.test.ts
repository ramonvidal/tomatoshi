import { describe, expect, it } from "vitest";
import { particleOpacity, stepParticle, type ParticleBody } from "../src/engine/particles";

const body = (over: Partial<ParticleBody> = {}): ParticleBody => ({
  x: 0, y: 0, vx: 0, vy: 0, gravity: 0, drag: 0, age: 0, life: 1, rot: 0, spin: 0, scale: 1, grow: 0, ...over,
});

describe("particles", () => {
  it("expire after their lifetime", () => {
    const p = body({ life: 0.5 });
    let steps = 0;
    while (stepParticle(p, 0.1)) steps++;
    expect(steps).toBe(4);
  });

  it("float up with negative gravity and fall with positive", () => {
    const up = body({ gravity: -100 });
    const down = body({ gravity: 100 });
    for (let i = 0; i < 5; i++) {
      stepParticle(up, 0.1);
      stepParticle(down, 0.1);
    }
    expect(up.y).toBeLessThan(0);
    expect(down.y).toBeGreaterThan(0);
  });

  it("slow down with drag and never shrink below zero", () => {
    const p = body({ vx: 100, drag: 5, grow: -10 });
    stepParticle(p, 0.5);
    expect(p.vx).toBeLessThan(10);
    expect(p.scale).toBe(0);
  });

  it("fade in, then out", () => {
    expect(particleOpacity(body({ age: 0 }))).toBe(0);
    expect(particleOpacity(body({ age: 0.4 }))).toBe(1);
    expect(particleOpacity(body({ age: 0.95 }))).toBeLessThan(0.2);
  });
});
