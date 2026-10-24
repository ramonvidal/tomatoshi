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
