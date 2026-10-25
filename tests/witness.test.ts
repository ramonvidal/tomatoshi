import { describe, expect, it } from "vitest";
import { DEFAULT_NEEDS } from "../src/friend/needs";
import { spamLevel, witness, type WitnessContext } from "../src/friend/witness";

const base: WitnessContext = {
  type: "lamp",
  kind: "toggled",
  state: { on: true },
  needs: DEFAULT_NEEDS,
  mood: "grumpy",
  asleep: false,
  usingThis: null,
  perchedHere: false,
};
const w = (over: Partial<WitnessContext>) => witness({ ...base, ...over });

describe("witness reactions", () => {
  it("squints when the lights come on", () => {
    expect(w({})).toMatchObject({ express: "sleepy" });
  });

  it("only wakes up for noise", () => {
    expect(w({ asleep: true })).toBeNull();
    expect(w({ asleep: true, type: "radio", state: { on: true } })).toEqual({ wake: true });
    expect(w({ asleep: true, type: "knives", kind: "rattled", state: {} })).toEqual({ wake: true });
  });

  it("goes for the fridge when hungry, shivers when not", () => {
    const fridge = { type: "fridge", state: { open: true } } as const;
    expect(w({ ...fridge, needs: { ...DEFAULT_NEEDS, fullness: 20 } })).toMatchObject({ go: "eat" });
    expect(w({ ...fridge, needs: { ...DEFAULT_NEEDS, fullness: 90 } })).toMatchObject({ shiver: true });
  });

  it("is annoyed when you switch off what it's enjoying", () => {
    expect(w({ type: "radio", state: { on: false }, usingThis: "dance" })).toMatchObject({ say: "anger" });
    expect(w({ type: "tv", kind: "channel", state: { channel: 0 }, usingThis: "watch" })).toMatchObject({ say: "anger" });
    expect(w({ type: "sprinkler", state: { on: false }, usingThis: "play" })).toMatchObject({ say: "anger" });
  });

  it("is quietly grateful when its cousins are watered", () => {
    const r = w({ type: "plant", kind: "watered", state: { water: 100 } });
    expect(r?.affection).toBeGreaterThan(0);
    expect(r?.hearts).toBe(1);
  });

  it("is flustered when swung in the hammock", () => {
    expect(w({ type: "hammock", kind: "swung", state: {}, perchedHere: true })).toMatchObject({ express: "flustered" });
  });

  it("ignores things it has no opinion on", () => {
    expect(w({ type: "ball", kind: "kicked", state: {} })).toBeNull();
  });
});

describe("getting fed up", () => {
  it("is fine with a couple of taps", () => {
    expect(spamLevel([0, 1], 1.5)).toBe("none");
  });

  it("gets annoyed, then furious, at repeated fiddling", () => {
    expect(spamLevel([0, 0.5, 1, 1.5], 1.6)).toBe("annoyed");
    expect(spamLevel([0, 0.4, 0.8, 1.2, 1.6, 2, 2.4], 2.5)).toBe("furious");
  });

  it("calms down once you stop", () => {
    expect(spamLevel([0, 0.5, 1, 1.5], 10)).toBe("none");
  });
});
