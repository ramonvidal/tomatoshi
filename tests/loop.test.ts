import { describe, expect, it } from "vitest";
import { Loop, MAX_DT, type LoopDeps } from "../src/engine/loop";

function fakeDeps() {
  let time = 0;
  let pending: (() => void) | null = null;
  const deps: LoopDeps = {
    now: () => time,
    requestFrame: (cb) => {
      pending = cb;
      return 1;
    },
    cancelFrame: () => {
      pending = null;
    },
  };
  const advance = (ms: number) => {
    time += ms;
    const cb = pending;
    pending = null;
    cb?.();
  };
  return { deps, advance };
}

describe("Loop", () => {
  it("passes elapsed seconds as dt and accumulates time", () => {
    const { deps, advance } = fakeDeps();
    const ticks: Array<[number, number]> = [];
    new Loop((dt, t) => ticks.push([dt, t]), deps).start();

    advance(16);
    advance(32);

    expect(ticks[0][0]).toBeCloseTo(0.016);
    expect(ticks[1][0]).toBeCloseTo(0.032);
    expect(ticks[1][1]).toBeCloseTo(0.048);
  });

  it("clamps long frames to MAX_DT", () => {
    const { deps, advance } = fakeDeps();
    const dts: number[] = [];
    new Loop((dt) => dts.push(dt), deps).start();

    advance(5000);

    expect(dts).toEqual([MAX_DT]);
  });

  it("stops ticking after stop()", () => {
    const { deps, advance } = fakeDeps();
    let count = 0;
    const loop = new Loop(() => count++, deps);
    loop.start();
    advance(16);
    loop.stop();
    advance(16);

    expect(count).toBe(1);
    expect(loop.running).toBe(false);
  });
});
