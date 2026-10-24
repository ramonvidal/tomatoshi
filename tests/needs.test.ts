import { describe, expect, it } from "vitest";
import { applyEffect, catchUp, decayNeeds, DEFAULT_NEEDS, moodOf, urgency } from "../src/friend/needs";

describe("needs", () => {
  it("drift down while awake and stay within 0..100", () => {
    const after = decayNeeds(DEFAULT_NEEDS, 60 * 60);
    for (const v of Object.values(after)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(after.fun).toBeLessThan(DEFAULT_NEEDS.fun);
    expect(after.fullness).toBeLessThan(DEFAULT_NEEDS.fullness);
  });

  it("recharge energy while asleep, and a little while sitting", () => {
    const tired = { ...DEFAULT_NEEDS, energy: 20 };
    expect(decayNeeds(tired, 60, "asleep").energy).toBeGreaterThan(25);
    expect(decayNeeds(tired, 60, "sitting").energy).toBeGreaterThan(20);
    expect(decayNeeds(tired, 60, "awake").energy).toBeLessThan(20);
  });

  it("applies effects with clamping", () => {
    expect(applyEffect(DEFAULT_NEEDS, { fullness: 1000 }).fullness).toBe(100);
    expect(applyEffect(DEFAULT_NEEDS, { affection: -1000 }).affection).toBe(0);
  });

  it("makes desperate needs much more urgent than satisfied ones", () => {
    expect(urgency(0)).toBeGreaterThan(urgency(100) * 10);
    expect(urgency(50)).toBeGreaterThan(urgency(90));
  });

  it("derives mood from the most pressing need", () => {
    expect(moodOf({ energy: 10, fun: 90, fullness: 90, affection: 90 })).toBe("sleepy");
    expect(moodOf({ energy: 90, fun: 90, fullness: 10, affection: 90 })).toBe("hungry");
    expect(moodOf({ energy: 90, fun: 90, fullness: 90, affection: 10 })).toBe("lonely");
    expect(moodOf({ energy: 90, fun: 30, fullness: 90, affection: 90 })).toBe("veryGrumpy");
    expect(moodOf({ energy: 90, fun: 90, fullness: 90, affection: 90 })).toBe("content");
    expect(moodOf(DEFAULT_NEEDS)).toBe("grumpy");
  });

  it("is gentle about time away: rested, a bit hungry, never wrecked", () => {
    const after = catchUp(DEFAULT_NEEDS, 3 * 24 * 3600);
    expect(after.energy).toBe(100);
    expect(after.fullness).toBeGreaterThanOrEqual(DEFAULT_NEEDS.fullness - 55);
    expect(after.affection).toBeGreaterThanOrEqual(DEFAULT_NEEDS.affection - 40);
    expect(catchUp(DEFAULT_NEEDS, 0)).toEqual(DEFAULT_NEEDS);
  });
});
