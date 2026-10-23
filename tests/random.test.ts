import { describe, expect, it } from "vitest";
import { seededRng, weighted } from "../src/engine/random";

describe("random", () => {
  it("produces values in [0, 1)", () => {
    const rng = seededRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("never picks zero-weight options", () => {
    const rng = seededRng(9);
    for (let i = 0; i < 500; i++) expect(weighted(rng, { a: 1, b: 0, c: 2 })).not.toBe("b");
  });
});
