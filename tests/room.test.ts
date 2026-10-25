import { describe, expect, it } from "vitest";
import { inDanger } from "../src/engine/room";

describe("danger zones", () => {
  const knives = { x: 345, y: 900, radius: 85, kind: "sharp" as const };

  it("covers points near the danger", () => {
    expect(inDanger(345, 900, knives)).toBe(true);
    expect(inDanger(400, 920, knives)).toBe(true);
  });

  it("is flatter in depth than across", () => {
    // 80 units to the side is inside; 80 units toward the front is not.
    expect(inDanger(345 + 80, 900, knives)).toBe(true);
    expect(inDanger(345, 900 + 80, knives)).toBe(false);
  });

  it("leaves the front of the room alone", () => {
    expect(inDanger(345, 1100, knives)).toBe(false);
  });
});

import { nextStep } from "../src/engine/house";
import { inBox } from "../src/objects/prop";
import { sunPosition } from "../src/objects/sky";

describe("finding the way between rooms", () => {
  const doors = new Map([
    ["garden", ["living-room"]],
    ["living-room", ["garden", "kitchen"]],
    ["kitchen", ["living-room"]],
  ]);

  it("goes through the living room to get from the kitchen to the garden", () => {
    expect(nextStep(doors, "kitchen", "garden")).toBe("living-room");
    expect(nextStep(doors, "living-room", "garden")).toBe("garden");
  });

  it("has nowhere to go when already there, or when there's no way", () => {
    expect(nextStep(doors, "kitchen", "kitchen")).toBeNull();
    expect(nextStep(doors, "kitchen", "attic")).toBeNull();
  });
});

describe("drop zones", () => {
  it("checks a point against a box", () => {
    expect(inBox({ x: 5, y: 5 }, 0, 0, 10, 10)).toBe(true);
    expect(inBox({ x: 11, y: 5 }, 0, 0, 10, 10)).toBe(false);
  });
});

describe("sun and moon", () => {
  it("rises on the left, peaks at midday, sets on the right", () => {
    const morning = sunPosition(7);
    const noon = sunPosition(13);
    const evening = sunPosition(19);
    expect(morning.x).toBeLessThan(noon.x);
    expect(noon.x).toBeLessThan(evening.x);
    expect(noon.arc).toBeGreaterThan(morning.arc);
    expect(noon.arc).toBeGreaterThan(evening.arc);
  });
});
