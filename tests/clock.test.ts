import { describe, expect, it } from "vitest";
import { hourOverride, skyAt } from "../src/engine/clock";

describe("clock", () => {
  it("reads an hour override from the URL", () => {
    expect(hourOverride("?hour=21.5")).toBe(21.5);
    expect(hourOverride("?hour=26")).toBe(2);
    expect(hourOverride("?hour=nope")).toBeNull();
    expect(hourOverride("")).toBeNull();
  });

  it("is full day at noon and dark at midnight", () => {
    expect(skyAt(12)).toMatchObject({ daylight: 1, body: "sun", stars: 0 });
    expect(skyAt(0)).toMatchObject({ daylight: 0, body: "moon", stars: 1 });
  });

  it("fades through twilight", () => {
    const evening = [18.5, 19, 19.5, 20, 20.5].map((h) => skyAt(h).daylight);
    for (let i = 1; i < evening.length; i++) expect(evening[i]).toBeLessThanOrEqual(evening[i - 1]);
    expect(skyAt(19.5).daylight).toBeGreaterThan(0);
    expect(skyAt(19.5).daylight).toBeLessThan(1);
    expect(skyAt(6.5).daylight).toBeCloseTo(skyAt(19.5).daylight);
  });
});
