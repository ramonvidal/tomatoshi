// Face presets. Numeric values are blended smoothly; eye and mouth shapes
// switch instantly.

import type { FaceState } from "./art";

export type Expression = Omit<FaceState, "lookX" | "lookY">;

export const expressions = {
  /** Default: unimpressed. */
  grumpy: { lid: 0.45, brow: 0.6, browLift: 0, blush: 0, eyes: "open", mouth: "frown" },
  /** Short glare after being bothered. */
  annoyed: { lid: 0.55, brow: 1, browLift: 0, blush: 0, eyes: "open", mouth: "flat" },
  angry: { lid: 0.25, brow: 1.2, browLift: 0, blush: 0, eyes: "open", mouth: "shout" },
  furious: { lid: 0, brow: 1.3, browLift: 0, blush: 0, eyes: "squeeze", mouth: "shout" },
  surprised: { lid: 0, brow: -0.3, browLift: 12, blush: 0, eyes: "open", mouth: "open" },
  /** Picked up: shocked and offended at the same time. */
  outraged: { lid: 0.05, brow: 1, browLift: 6, blush: 0, eyes: "open", mouth: "open" },
  holdingLaugh: { lid: 0.2, brow: 0.2, browLift: 2, blush: 0.3, eyes: "squeeze", mouth: "wobble" },
  /** Being stroked: pretending not to enjoy it. */
  flustered: { lid: 0.55, brow: -0.2, browLift: 0, blush: 1, eyes: "open", mouth: "flat" },
  secretlyHappy: { lid: 0.7, brow: -0.4, browLift: 0, blush: 1, eyes: "open", mouth: "smirk" },
  squished: { lid: 0, brow: 1.2, browLift: 0, blush: 0, eyes: "squeeze", mouth: "wobble" },
  dizzy: { lid: 0, brow: -0.6, browLift: 4, blush: 0, eyes: "spiral", mouth: "squiggle" },
  /** Sulking when ignored. */
  sulky: { lid: 0.6, brow: -0.3, browLift: 0, blush: 0, eyes: "open", mouth: "frown" },
} satisfies Record<string, Expression>;

export type ExpressionName = keyof typeof expressions;

const approach = (from: number, to: number, rate: number, dt: number) =>
  to + (from - to) * Math.exp(-rate * dt);

/** Move `current` toward `target` (frame-rate independent). Shapes snap. */
export function blendFace(current: FaceState, target: FaceState, dt: number, rate = 14): FaceState {
  return {
    lid: approach(current.lid, target.lid, rate, dt),
    brow: approach(current.brow, target.brow, rate, dt),
    browLift: approach(current.browLift, target.browLift, rate, dt),
    // Blush comes quickly and fades slowly: it's hard to hide.
    blush: approach(current.blush, target.blush, target.blush > current.blush ? 6 : 0.8, dt),
    lookX: approach(current.lookX, target.lookX, 8, dt),
    lookY: approach(current.lookY, target.lookY, 8, dt),
    eyes: target.eyes,
    mouth: target.mouth,
  };
}
