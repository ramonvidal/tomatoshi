import { describe, expect, it } from "vitest";
import { GESTURE, GestureRecognizer, type Gesture } from "../src/engine/input";

function setup() {
  const gestures: Gesture[] = [];
  const r = new GestureRecognizer((g) => gestures.push(g));
  const types = () => gestures.map((g) => g.type);
  return { r, gestures, types };
}

describe("GestureRecognizer", () => {
  it("recognizes a quick press without movement as a tap", () => {
    const { r, gestures } = setup();
    r.down(100, 100, 0, "body");
    r.up(102, 101, 120);
    expect(gestures).toEqual([{ type: "tap", target: "body", x: 100, y: 100, count: 1 }]);
  });

  it("counts quick consecutive taps on the same target", () => {
    const { r, gestures } = setup();
    for (let i = 0; i < 4; i++) {
      r.down(100, 100, i * 200, "body");
      r.up(100, 100, i * 200 + 80);
    }
    expect(gestures.map((g) => (g.type === "tap" ? g.count : -1))).toEqual([1, 2, 3, 4]);
  });

  it("resets the tap count after a pause", () => {
    const { r, gestures } = setup();
    r.down(100, 100, 0, "body");
    r.up(100, 100, 80);
    r.down(100, 100, 80 + GESTURE.multiTapGapMs + 200, "body");
    r.up(100, 100, 80 + GESTURE.multiTapGapMs + 280);
    expect(gestures.map((g) => (g.type === "tap" ? g.count : -1))).toEqual([1, 1]);
  });

  it("fires a long press while still held, and ends it on release", () => {
    const { r, types } = setup();
    r.down(100, 100, 0, "body");
    r.update(GESTURE.longPressMs - 1);
    expect(types()).toEqual([]);
    r.update(GESTURE.longPressMs);
    expect(types()).toEqual(["longPressStart"]);
    r.up(100, 100, 2000);
    expect(types()).toEqual(["longPressStart", "longPressEnd"]);
  });

  it("does not long press on empty space", () => {
    const { r, types } = setup();
    r.down(100, 100, 0, "none");
    r.update(5000);
    r.up(100, 100, 5000);
    expect(types()).toEqual([]);
  });

  it("treats rubbing back and forth as a stroke", () => {
    const { r, gestures, types } = setup();
    r.down(100, 100, 0, "body");
    r.move(140, 100, 50);
    r.move(100, 100, 100); // reversal
    r.move(140, 100, 150);
    r.up(140, 100, 200);
    expect(types()).toEqual(["strokeStart", "stroke", "stroke", "strokeEnd"]);
    const rubbed = gestures.reduce((sum, g) => sum + (g.type === "stroke" ? g.distance : 0), 0);
    expect(rubbed).toBeCloseTo(120);
  });

  it("treats moving steadily away as a drag", () => {
    const { r, gestures, types } = setup();
    r.down(100, 100, 0, "body");
    r.move(160, 100, 50);
    r.move(230, 100, 100);
    r.move(300, 100, 150);
    r.move(340, 100, 200);
    r.up(340, 100, 400);
    expect(types()).toEqual(["dragStart", "dragMove", "dragEnd"]);
    expect(gestures[0]).toMatchObject({ startX: 100, startY: 100 });
  });

  it("keeps rubbing a stroke while it stays on the target, however wide", () => {
    const { r, types } = setup();
    const body = { cx: 300, cy: 300, rx: 110, ry: 95 };
    r.down(200, 300, 0, "body", body);
    for (let i = 1; i <= 6; i++) r.move(i % 2 ? 400 : 200, 300, i * 40);
    r.up(200, 300, 300);
    expect(types()[0]).toBe("strokeStart");
    expect(types()).not.toContain("dragStart");
  });

  it("starts a drag as soon as the finger leaves the target", () => {
    const { r, types } = setup();
    const body = { cx: 300, cy: 300, rx: 110, ry: 95 };
    r.down(300, 300, 0, "body", body);
    r.move(400, 330, 40);
    expect(types()).toEqual([]);
    r.move(450, 340, 80);
    expect(types()).toEqual(["dragStart"]);
  });

  it("counts a single pass over the target as a short stroke", () => {
    const { r, gestures, types } = setup();
    const body = { cx: 300, cy: 300, rx: 110, ry: 95 };
    r.down(300, 230, 0, "body", body);
    r.move(300, 300, 100);
    r.move(300, 360, 200);
    r.up(300, 360, 250);
    expect(types()).toEqual(["strokeStart", "stroke", "strokeEnd"]);
    expect(gestures[1]).toMatchObject({ distance: 130 });
  });

  it("starts a drag sooner when lifting upward", () => {
    const { r, types } = setup();
    r.down(100, 300, 0, "stem");
    r.move(100, 300 - GESTURE.liftDistance - 5, 60);
    expect(types()).toEqual(["dragStart"]);
  });

  it("reports release velocity so fast drags become flicks", () => {
    const { r, gestures } = setup();
    r.down(100, 100, 0, "body");
    r.move(250, 100, 50);
    r.move(400, 100, 100);
    r.up(550, 100, 150); // 150 units per 50 ms
    const end = gestures.at(-1);
    expect(end?.type).toBe("dragEnd");
    if (end?.type === "dragEnd") expect(end.vx).toBeCloseTo(3000, -1);
  });

  it("turns a long press into a drag when the finger then moves", () => {
    const { r, types } = setup();
    r.down(100, 100, 0, "body");
    r.update(GESTURE.longPressMs);
    r.move(100 + GESTURE.slop * 3, 100, GESTURE.longPressMs + 50);
    expect(types()).toEqual(["longPressStart", "longPressEnd", "dragStart"]);
  });

  it("ignores drags that start on empty space but still taps it", () => {
    const { r, types } = setup();
    r.down(100, 100, 0, "none");
    r.move(300, 100, 50);
    r.up(300, 100, 100);
    r.down(100, 100, 1000, "none");
    r.up(100, 100, 1050);
    expect(types()).toEqual(["tap"]);
  });

  it("does not tap when the pointer is cancelled", () => {
    const { r, types } = setup();
    r.down(100, 100, 0, "body");
    r.cancel(50);
    expect(types()).toEqual([]);
  });
});
