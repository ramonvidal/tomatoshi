// Tomatoshi's SVG body. Drawn around (0, 0) = the point between its feet,
// with each part in its own element so it can be animated on its own.

import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";

/** Body radius in stage units. */
export const BODY_RX = 110;
export const BODY_RY = 95;
/** Vertical center of the body, relative to the feet. */
export const BODY_CY = -BODY_RY - 18;
/** Top of the stem, relative to the feet. */
export const HEAD_TOP = BODY_CY - BODY_RY - 30;

const EYE_X = 38;
const EYE_Y = BODY_CY - 4;
const EYE_RY = 19;
const MOUTH_Y = BODY_CY + 32;

export interface EyeParts {
  open: SVGGElement;
  pupil: SVGGElement;
  lid: SVGRectElement;
  squeeze: SVGPathElement;
  spiral: SVGPathElement;
}

export interface TomatoshiParts {
  root: SVGGElement;
  shadow: SVGEllipseElement;
  body: SVGGElement;
  feet: [SVGEllipseElement, SVGEllipseElement];
  face: SVGGElement;
  eyes: [EyeParts, EyeParts];
  brows: [SVGPathElement, SVGPathElement];
  mouth: SVGPathElement;
  cheeks: SVGGElement;
  stem: SVGGElement;
}

/** Points of an Archimedean spiral, as an SVG path. */
export function spiralPath(cx: number, cy: number, radius: number, turns: number): string {
  const steps = Math.ceil(turns * 24);
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * turns * Math.PI * 2;
    const r = (i / steps) * radius;
    points.push(`${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M ${points.join(" L ")}`;
}

function drawEye(side: -1 | 1): { group: SVGGElement; parts: EyeParts } {
  const x = side * EYE_X;
  const pupil = svgEl("g", { class: "pupil" }, [
    svgEl("ellipse", { cx: x, cy: EYE_Y, rx: 15, ry: EYE_RY, fill: c.ink }),
    svgEl("circle", { cx: x + 5, cy: EYE_Y - 6, r: 5, fill: c.white }),
  ]);
  // The lid is body-colored and slides down over the eye: grumpiness, blinks.
  const lid = svgEl("rect", { x: x - 20, y: EYE_Y - EYE_RY - 4, width: 40, height: 0, fill: c.tomato });
  const open = svgEl("g", { class: "eye-open" }, [pupil, lid]);

  // ">" "<" squeezed shut eyes, pointing inward.
  const squeeze = svgEl("path", {
    class: "eye-squeeze",
    d: `M ${x + side * 14} ${EYE_Y - 14} L ${x - side * 10} ${EYE_Y} L ${x + side * 14} ${EYE_Y + 14}`,
    stroke: c.ink,
    "stroke-width": 8,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    fill: "none",
    display: "none",
  });

  const spiral = svgEl("path", {
    class: "eye-spiral",
    d: spiralPath(x, EYE_Y, 17, 2.5),
    stroke: c.ink,
    "stroke-width": 5,
    "stroke-linecap": "round",
    fill: "none",
    display: "none",
  });

  return {
    group: svgEl("g", { class: "eye" }, [open, squeeze, spiral]),
    parts: { open, pupil, lid, squeeze, spiral },
  };
}

export function drawTomatoshi(): TomatoshiParts {
  const cy = BODY_CY;

  const shadow = svgEl("ellipse", { cx: 0, cy: 0, rx: 95, ry: 16, fill: c.shadow, class: "shadow" });

  const foot = (x: number) => svgEl("ellipse", { cx: x, cy: -8, rx: 26, ry: 14, fill: c.tomatoDark });
  const feet: [SVGEllipseElement, SVGEllipseElement] = [foot(-42), foot(42)];

  const left = drawEye(-1);
  const right = drawEye(1);

  const brow = () =>
    svgEl("path", { stroke: c.ink, "stroke-width": 9, "stroke-linecap": "round", fill: "none" });
  const brows: [SVGPathElement, SVGPathElement] = [brow(), brow()];

  const mouth = svgEl("path", {
    class: "mouth",
    stroke: c.ink,
    "stroke-width": 7,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });

  const cheeks = svgEl("g", { class: "cheeks", opacity: 0 }, [
    svgEl("ellipse", { cx: -70, cy: cy + 22, rx: 18, ry: 10, fill: c.blush }),
    svgEl("ellipse", { cx: 70, cy: cy + 22, rx: 18, ry: 10, fill: c.blush }),
  ]);

  const face = svgEl("g", { class: "face" }, [cheeks, left.group, right.group, ...brows, mouth]);

  const top = cy - BODY_RY + 6;
  const leaf = (angle: number) =>
    svgEl("path", {
      d: `M 0 ${top} q 18 -10 52 4 q -30 14 -52 -4 z`,
      fill: c.leaf,
      transform: `rotate(${angle} 0 ${top})`,
    });
  // Invisible, larger hit area so the stem is easy to poke with a finger.
  const stemHit = svgEl("ellipse", { cx: 0, cy: top - 6, rx: 50, ry: 32, fill: "transparent" });
  const stem = svgEl("g", { class: "stem" }, [
    stemHit,
    leaf(-20), leaf(35), leaf(150), leaf(205), leaf(270),
    svgEl("rect", { x: -6, y: top - 30, width: 12, height: 34, rx: 6, fill: c.leafDark }),
  ]);

  const body = svgEl("g", { class: "body" }, [
    svgEl("ellipse", { cx: 0, cy, rx: BODY_RX, ry: BODY_RY, fill: c.tomato }),
    svgEl("ellipse", { cx: -80, cy: cy - 46, rx: 18, ry: 10, fill: c.tomatoLight, transform: `rotate(-40 -80 ${cy - 46})` }),
    face,
    stem,
  ]);

  const root = svgEl("g", { class: "tomatoshi" }, [...feet, body]);
  return {
    root,
    shadow,
    body,
    feet,
    face,
    eyes: [left.parts, right.parts],
    brows,
    mouth,
    cheeks,
    stem,
  };
}

// ---------------------------------------------------------------------------
// Face rendering

export type EyeShape = "open" | "squeeze" | "spiral";
export type MouthShape = "frown" | "flat" | "wobble" | "open" | "shout" | "smirk" | "squiggle";

export interface FaceState {
  /** 0 = eyes wide open, 1 = fully closed. */
  lid: number;
  /** -1 worried (inner ends up) … 0 flat … 1 angry (inner ends down). */
  brow: number;
  /** Extra lift for both brows (surprise), in stage units. */
  browLift: number;
  /** 0..1 */
  blush: number;
  /** Where it looks, -1..1 on each axis. */
  lookX: number;
  lookY: number;
  eyes: EyeShape;
  mouth: MouthShape;
}

const MOUTHS: Record<MouthShape, { d: string; filled: boolean }> = {
  frown: { d: "M -16 6 Q 0 -6 16 6", filled: false },
  flat: { d: "M -14 0 L 14 0", filled: false },
  wobble: { d: "M -20 2 l 7 -5 l 7 5 l 7 -5 l 7 5 l 6 -5", filled: false },
  open: { d: "M -11 -6 Q 0 -14 11 -6 Q 14 10 0 12 Q -14 10 -11 -6 Z", filled: true },
  shout: { d: "M -22 -6 L 22 -6 Q 18 16 0 16 Q -18 16 -22 -6 Z", filled: true },
  smirk: { d: "M -14 0 Q 2 9 16 -5", filled: false },
  squiggle: { d: "M -20 0 q 5 -8 10 0 t 10 0 t 10 0 t 10 0", filled: false },
};

export function renderFace(parts: TomatoshiParts, f: FaceState): void {
  // Turning the whole face sells "looking"; pupils add a little more.
  parts.face.setAttribute("transform", `translate(${(f.lookX * 14).toFixed(2)} ${(f.lookY * 8).toFixed(2)})`);

  for (const eye of parts.eyes) {
    eye.open.setAttribute("display", f.eyes === "open" ? "inline" : "none");
    eye.squeeze.setAttribute("display", f.eyes === "squeeze" ? "inline" : "none");
    eye.spiral.setAttribute("display", f.eyes === "spiral" ? "inline" : "none");
    eye.pupil.setAttribute("transform", `translate(${(f.lookX * 5).toFixed(2)} ${(f.lookY * 4).toFixed(2)})`);
    eye.lid.setAttribute("height", String(Math.max(0, f.lid) * (EYE_RY * 2 + 6)));
  }

  parts.brows.forEach((brow, i) => {
    const side = i === 0 ? -1 : 1;
    // Heavy lids pull the brows down a little.
    const base = EYE_Y - 34 - f.browLift + Math.max(0, f.lid - 0.5) * 8;
    const outer = base - 4 - f.brow * 3;
    const inner = base + f.brow * 10;
    brow.setAttribute("d", `M ${side * 62} ${outer.toFixed(2)} L ${side * 18} ${inner.toFixed(2)}`);
  });

  const mouth = MOUTHS[f.mouth];
  parts.mouth.setAttribute("d", mouth.d);
  parts.mouth.setAttribute("transform", `translate(0 ${MOUTH_Y})`);
  parts.mouth.setAttribute("fill", mouth.filled ? c.ink : "none");

  parts.cheeks.setAttribute("opacity", f.blush.toFixed(3));
}
