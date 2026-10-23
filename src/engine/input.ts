// Turns raw pointer samples into gestures: tap (with multi-tap count),
// long press, stroke (rubbing while staying on the target) and drag (leaving
// the target or lifting it, with release velocity so a fast drag is a flick).
//
// The recognizer is pure: it is fed positions in stage units and
// timestamps in ms, which keeps it testable without a browser.

import type { Stage } from "./stage";

/** What was pressed: part of Tomatoshi, a room object, or empty space. */
export type Target = "body" | "stem" | "none" | `prop:${string}`;

export type Gesture =
  | { type: "tap"; target: Target; x: number; y: number; count: number }
  | { type: "longPressStart"; target: Target }
  | { type: "longPressEnd"; target: Target }
  | { type: "strokeStart"; target: Target }
  | { type: "stroke"; target: Target; distance: number }
  | { type: "strokeEnd"; target: Target }
  | { type: "dragStart"; target: Target; x: number; y: number; startX: number; startY: number }
  | { type: "dragMove"; target: Target; x: number; y: number }
  | { type: "dragEnd"; target: Target; x: number; y: number; vx: number; vy: number };

/** Distances are in stage units, times in ms. */
export const GESTURE = {
  /** Movement allowed before a press stops being a tap / long press. */
  slop: 18,
  tapMaxMs: 320,
  /** Max gap between taps for them to count as a multi-tap. */
  multiTapGapMs: 450,
  longPressMs: 550,
  /** Straight-line distance that turns a press into a drag, when the target's bounds are unknown. */
  dragDistance: 160,
  /** Upward distance that turns a press into a drag (lifting). */
  liftDistance: 80,
  /** Bounds are grown by this factor, so rubbing near the edge stays a stroke. */
  boundsMargin: 1.15,
  /** Minimum swing before a change of direction counts as rubbing. */
  reversal: 16,
  /** Window used to estimate release velocity. */
  velocityWindowMs: 80,
} as const;

type Phase = "idle" | "pending" | "longPress" | "stroke" | "drag" | "ignored";

/** Ellipse covering the pressed target, in stage units. */
export interface Bounds {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Tracks one axis of movement to spot back-and-forth rubbing. */
class ReversalTracker {
  private dir = 0;
  private extreme = 0;

  reset(start: number): void {
    this.dir = 0;
    this.extreme = start;
  }

  /** Returns true when travel along this axis has just changed direction. */
  track(start: number, v: number): boolean {
    if (this.dir === 0) {
      if (Math.abs(v - start) > GESTURE.reversal) {
        this.dir = Math.sign(v - start);
        this.extreme = v;
      }
      return false;
    }
    if ((v - this.extreme) * this.dir > 0) {
      this.extreme = v;
      return false;
    }
    if ((this.extreme - v) * this.dir > GESTURE.reversal) {
      this.dir = -this.dir;
      this.extreme = v;
      return true;
    }
    return false;
  }
}

interface Sample {
  x: number;
  y: number;
  t: number;
}

export class GestureRecognizer {
  private phase: Phase = "idle";
  private target: Target = "none";
  private start: Sample = { x: 0, y: 0, t: 0 };
  private last: Sample = { x: 0, y: 0, t: 0 };
  private samples: Sample[] = [];
  private movedBeyondSlop = false;
  /** Distance travelled since the press, so a stroke counts its first rubs. */
  private travelled = 0;

  private bounds: Bounds | null = null;
  private readonly reversalX = new ReversalTracker();
  private readonly reversalY = new ReversalTracker();

  private lastTap = { t: -Infinity, target: "none" as Target, count: 0 };

  constructor(private readonly emit: (gesture: Gesture) => void) {}

  get active(): boolean {
    return this.phase !== "idle";
  }

  down(x: number, y: number, t: number, target: Target, bounds: Bounds | null = null): void {
    this.phase = "pending";
    this.target = target;
    this.bounds = bounds;
    this.start = { x, y, t };
    this.last = this.start;
    this.samples = [this.start];
    this.movedBeyondSlop = false;
    this.travelled = 0;
    this.reversalX.reset(x);
    this.reversalY.reset(y);
  }

  move(x: number, y: number, t: number): void {
    if (this.phase === "idle") return;
    const prev = this.last;
    this.last = { x, y, t };
    this.samples.push(this.last);
    this.samples = this.samples.filter((s) => t - s.t <= GESTURE.velocityWindowMs * 2);

    const step = Math.hypot(x - prev.x, y - prev.y);
    this.travelled += step;
    const dx = x - this.start.x;
    const dy = y - this.start.y;
    if (Math.hypot(dx, dy) > GESTURE.slop) this.movedBeyondSlop = true;
    // Track both axes every time (no short-circuit) so neither goes stale.
    const reversedX = this.reversalX.track(this.start.x, x);
    const reversedY = this.reversalY.track(this.start.y, y);
    const reversed = reversedX || reversedY;

    switch (this.phase) {
      case "pending":
        if (!this.movedBeyondSlop) return;
        if (this.target === "none") {
          this.phase = "ignored";
        } else if (reversed) {
          this.phase = "stroke";
          this.emit({ type: "strokeStart", target: this.target });
          this.emit({ type: "stroke", target: this.target, distance: this.travelled });
        } else if (-dy > GESTURE.liftDistance || this.leftTarget(x, y)) {
          this.beginDrag(x, y);
        }
        return;
      case "longPress":
        // Holding and then moving picks it up.
        if (Math.hypot(dx, dy) > GESTURE.slop * 2) {
          this.emit({ type: "longPressEnd", target: this.target });
          this.beginDrag(x, y);
        }
        return;
      case "stroke":
        this.emit({ type: "stroke", target: this.target, distance: step });
        return;
      case "drag":
        this.emit({ type: "dragMove", target: this.target, x, y });
        return;
    }
  }

  up(x: number, y: number, t: number): void {
    if (this.phase === "idle") return;
    if (x !== this.last.x || y !== this.last.y) this.move(x, y, t);

    switch (this.phase) {
      case "pending":
        if (!this.movedBeyondSlop) {
          if (t - this.start.t <= GESTURE.tapMaxMs) this.tap(t);
        } else if (this.target !== "none") {
          // A single pass over it without picking it up: a one-way pet.
          this.emit({ type: "strokeStart", target: this.target });
          this.emit({ type: "stroke", target: this.target, distance: this.travelled });
          this.emit({ type: "strokeEnd", target: this.target });
        }
        break;
      case "longPress":
        this.emit({ type: "longPressEnd", target: this.target });
        break;
      case "stroke":
        this.emit({ type: "strokeEnd", target: this.target });
        break;
      case "drag": {
        const { vx, vy } = this.velocity(t);
        this.emit({ type: "dragEnd", target: this.target, x, y, vx, vy });
        break;
      }
    }
    this.phase = "idle";
  }

  /** Pointer lost (e.g. pointercancel): end without producing a tap. */
  cancel(t: number): void {
    if (this.phase === "pending") this.phase = "ignored";
    this.up(this.last.x, this.last.y, t);
  }

  /** Call every frame so long presses fire while the finger is still. */
  update(t: number): void {
    if (
      this.phase === "pending" &&
      this.target !== "none" &&
      !this.movedBeyondSlop &&
      t - this.start.t >= GESTURE.longPressMs
    ) {
      this.phase = "longPress";
      this.emit({ type: "longPressStart", target: this.target });
    }
  }

  private beginDrag(x: number, y: number): void {
    this.phase = "drag";
    this.emit({ type: "dragStart", target: this.target, x, y, startX: this.start.x, startY: this.start.y });
  }

  private tap(t: number): void {
    const quick = t - this.lastTap.t <= GESTURE.multiTapGapMs && this.lastTap.target === this.target;
    const count = quick ? this.lastTap.count + 1 : 1;
    this.lastTap = { t, target: this.target, count };
    this.emit({ type: "tap", target: this.target, x: this.start.x, y: this.start.y, count });
  }

  private leftTarget(x: number, y: number): boolean {
    const b = this.bounds;
    if (!b) return Math.hypot(x - this.start.x, y - this.start.y) > GESTURE.dragDistance;
    const nx = (x - b.cx) / (b.rx * GESTURE.boundsMargin);
    const ny = (y - b.cy) / (b.ry * GESTURE.boundsMargin);
    return nx * nx + ny * ny > 1;
  }

  /** Release velocity in stage units per second. */
  private velocity(t: number): { vx: number; vy: number } {
    const recent = this.samples.filter((s) => t - s.t <= GESTURE.velocityWindowMs);
    if (recent.length < 2) return { vx: 0, vy: 0 };
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0) return { vx: 0, vy: 0 };
    return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
  }
}

/** Classify what part of the scene a DOM element belongs to. */
export function targetOf(el: Element | null): Target {
  if (el?.closest(".tomatoshi .stem")) return "stem";
  if (el?.closest(".tomatoshi")) return "body";
  const prop = el?.closest<SVGElement>("[data-prop]")?.dataset.prop;
  return prop ? `prop:${prop}` : "none";
}

export const propIdOf = (target: Target): string | null =>
  target.startsWith("prop:") ? target.slice(5) : null;

export interface PointerHandlers {
  recognizer: GestureRecognizer;
  /** Area of a pressed target, so the recognizer knows when the finger leaves it. */
  boundsOf: (target: Target) => Bounds | null;
  /** Called with every pointer position, pressed or not (eyes follow it). */
  onPoint: (x: number, y: number) => void;
}

/** Wire DOM pointer events on the stage to the recognizer. Single-pointer. */
export function attachPointerInput(stage: Stage, { recognizer, boundsOf, onPoint }: PointerHandlers): void {
  const svg = stage.svg;
  let pointerId: number | null = null;

  svg.addEventListener("pointerdown", (e) => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    svg.setPointerCapture(e.pointerId);
    const p = stage.toStage(e.clientX, e.clientY);
    onPoint(p.x, p.y);
    const target = targetOf(e.target as Element);
    recognizer.down(p.x, p.y, e.timeStamp, target, boundsOf(target));
  });

  svg.addEventListener("pointermove", (e) => {
    const p = stage.toStage(e.clientX, e.clientY);
    if (pointerId === null) {
      if (e.pointerType === "mouse") onPoint(p.x, p.y);
      return;
    }
    if (e.pointerId !== pointerId) return;
    onPoint(p.x, p.y);
    recognizer.move(p.x, p.y, e.timeStamp);
  });

  const end = (e: PointerEvent, cancelled: boolean) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    const p = stage.toStage(e.clientX, e.clientY);
    if (cancelled) recognizer.cancel(e.timeStamp);
    else recognizer.up(p.x, p.y, e.timeStamp);
  };
  svg.addEventListener("pointerup", (e) => end(e, false));
  svg.addEventListener("pointercancel", (e) => end(e, true));
  svg.addEventListener("contextmenu", (e) => e.preventDefault());
}
