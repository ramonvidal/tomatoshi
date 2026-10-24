import { describe, expect, it } from "vitest";
import { waterAfter } from "../src/objects/plant";
import { CHANNEL, nextChannel } from "../src/objects/tv";

describe("tv", () => {
  it("cycles off → bars → static → cooking → off", () => {
    const seen: number[] = [CHANNEL.off];
    for (let i = 0; i < 4; i++) seen.push(nextChannel(seen[seen.length - 1]));
    expect(seen).toEqual([CHANNEL.off, CHANNEL.bars, CHANNEL.static, CHANNEL.cooking, CHANNEL.off]);
  });
});

describe("plant", () => {
  it("dries out over about 40 minutes, never below zero", () => {
    expect(waterAfter(100, 20 * 60)).toBeCloseTo(50);
    expect(waterAfter(100, 40 * 60)).toBe(0);
    expect(waterAfter(10, 3600)).toBe(0);
  });
});
