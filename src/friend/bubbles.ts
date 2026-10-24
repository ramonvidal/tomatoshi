// Speech bubbles with symbols only. Symbols are drawn as SVG so they look
// the same on every device and match the flat art style.

import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { spiralPath } from "./art";

export type BubbleSymbol =
  | "exclaim"
  | "question"
  | "grawlix"
  | "anger"
  | "heart"
  | "note"
  | "zzz"
  | "ellipsis"
  | "dizzy"
  | "snack";

const RED = "#e5484d";
const YELLOW = "#f2c14e";

const line = (d: string, stroke: string = c.ink, width = 8) =>
  svgEl("path", { d, stroke, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" });

function star(cx: number, cy: number, r: number, fill: string) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`;
  });
  return svgEl("polygon", { points: points.join(" "), fill });
}

/** Each symbol is drawn centered on (0, 0); `width` sizes the bubble. */
const SYMBOLS: Record<BubbleSymbol, { width: number; draw: () => SVGElement[] }> = {
  exclaim: {
    width: 40,
    draw: () => [
      svgEl("rect", { x: -6, y: -26, width: 12, height: 32, rx: 6, fill: c.ink }),
      svgEl("circle", { cx: 0, cy: 18, r: 7, fill: c.ink }),
    ],
  },
  question: {
    width: 44,
    draw: () => [
      line("M -13 -12 C -13 -30 15 -30 15 -14 C 15 -4 2 -4 2 6", c.ink, 9),
      svgEl("circle", { cx: 2, cy: 20, r: 6, fill: c.ink }),
    ],
  },
  grawlix: {
    width: 96,
    draw: () => [
      // Lightning bolt
      svgEl("polygon", { points: "-38,-24 -24,-24 -30,-4 -18,-4 -36,24 -31,2 -43,2", fill: YELLOW }),
      // Hash
      line("M -8 -18 L -12 18 M 6 -18 L 2 18 M -16 -6 L 12 -6 M -18 6 L 10 6", c.ink, 5),
      // Star
      star(34, 0, 18, RED),
    ],
  },
  anger: {
    width: 56,
    draw: () =>
      [0, 90, 180, 270].map((angle) => {
        const bracket = line("M -22 -7 Q -7 -7 -7 -22", RED, 7);
        bracket.setAttribute("transform", `rotate(${angle})`);
        return bracket;
      }),
  },
  heart: {
    width: 52,
    draw: () => [
      svgEl("path", {
        d: "M 0 20 C -30 0 -24 -24 -8 -22 C -3 -21 0 -16 0 -12 C 0 -16 3 -21 8 -22 C 24 -24 30 0 0 20 Z",
        fill: RED,
      }),
    ],
  },
  note: {
    width: 44,
    draw: () => [
      svgEl("ellipse", { cx: -6, cy: 16, rx: 10, ry: 8, fill: c.ink, transform: "rotate(-20 -6 16)" }),
      svgEl("rect", { x: 1, y: -24, width: 6, height: 40, fill: c.ink }),
      svgEl("path", { d: "M 4 -24 Q 22 -18 18 -2 Q 14 -12 4 -12 Z", fill: c.ink }),
    ],
  },
  zzz: {
    width: 62,
    draw: () => {
      const z = (x: number, y: number, s: number) =>
        line(`M ${x} ${y} h ${14 * s} l ${-14 * s} ${16 * s} h ${14 * s}`, c.ink, 5 * Math.sqrt(s));
      return [z(-22, -2, 1.1), z(0, -14, 0.8), z(16, -24, 0.6)];
    },
  },
  ellipsis: {
    width: 60,
    draw: () => [-17, 0, 17].map((x) => svgEl("circle", { cx: x, cy: 4, r: 5.5, fill: c.ink })),
  },
  dizzy: {
    width: 48,
    draw: () => [line(spiralPath(0, 0, 18, 2.5), c.ink, 5)],
  },
  /** Hungry: the snack from the bowl, with a bite missing. */
  snack: {
    width: 50,
    draw: () => [
      svgEl("circle", { cx: 0, cy: 0, r: 22, fill: c.snack }),
      svgEl("circle", { cx: 18, cy: -14, r: 10, fill: c.white }),
      ...[
        [-8, -6],
        [6, 4],
        [-4, 10],
        [10, -2],
      ].map(([x, y]) => svgEl("circle", { cx: x, cy: y, r: 3, fill: c.snackDark })),
    ],
  },
};

export const BUBBLE_HEIGHT = 74;

/**
 * One bubble at a time, anchored to a point (the friend's head) that the
 * owner updates every frame.
 */
export class SpeechBubble {
  readonly root = svgEl("g", { class: "bubble", display: "none", "pointer-events": "none" });
  private readonly inner = svgEl("g");
  private age = 0;
  private duration = 0;
  private current: BubbleSymbol | null = null;
  /** 1 = bubble to the right of the anchor, -1 = to the left. */
  private side: 1 | -1 = 1;

  constructor() {
    this.root.appendChild(this.inner);
  }

  get symbol(): BubbleSymbol | null {
    return this.current;
  }

  show(symbol: BubbleSymbol, duration = 1.6): void {
    if (this.current !== symbol) {
      this.inner.replaceChildren(...this.draw(symbol, this.side));
      this.age = 0;
    } else {
      // Same symbol again: keep it up without re-popping.
      this.age = Math.min(this.age, 0.25);
    }
    this.current = symbol;
    this.duration = duration;
    this.root.setAttribute("display", "inline");
  }

  hide(): void {
    this.current = null;
    this.root.setAttribute("display", "none");
  }

  /** `x`, `y` is where the tail points (just above the head). */
  update(dt: number, x: number, y: number, side: 1 | -1 = 1): void {
    if (side !== this.side) {
      this.side = side;
      if (this.current) this.inner.replaceChildren(...this.draw(this.current, side));
    }
    if (!this.current) return;
    this.age += dt;
    if (this.age >= this.duration) {
      this.hide();
      return;
    }
    // Pop in with a little overshoot, shrink away at the end.
    const t = Math.min(this.age / 0.22, 1);
    const pop = t < 1 ? 1.15 * Math.sin((t * Math.PI) / 2) : 1;
    const out = Math.min((this.duration - this.age) / 0.15, 1);
    const scale = Math.max(0.01, pop * out);
    this.root.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)})`);
  }

  private draw(symbol: BubbleSymbol, side: 1 | -1): SVGElement[] {
    const { width, draw } = SYMBOLS[symbol];
    const w = width + 36;
    const h = BUBBLE_HEIGHT;
    // Bubble sits above the anchor, off to one side, with the tail pointing at it.
    const bx = side > 0 ? -18 : 18 - w;
    const by = -h - 18;
    const tailX = side > 0 ? bx + 16 : bx + w - 40;
    const symbolGroup = svgEl("g", { transform: `translate(${bx + w / 2} ${by + h / 2})` }, draw());
    return [
      svgEl("path", { d: `M 0 0 L ${tailX} ${by + h - 4} L ${tailX + 24} ${by + h - 4} Z`, fill: c.white }),
      svgEl("rect", { x: bx, y: by, width: w, height: h, rx: h / 2, fill: c.white }),
      symbolGroup,
    ];
  }
}
