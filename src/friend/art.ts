// Tomatoshi's SVG body. Drawn around (0, 0) = the point between its feet,
// with each part in its own named group so it can be animated on its own.

import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";

export interface TomatoshiParts {
  root: SVGGElement;
  body: SVGGElement;
  eyes: SVGGElement;
  brows: SVGGElement;
  mouth: SVGPathElement;
  cheeks: SVGGElement;
  stem: SVGGElement;
}

/** Body radius in stage units. */
export const BODY_RX = 110;
export const BODY_RY = 95;

export function drawTomatoshi(): TomatoshiParts {
  const cy = -BODY_RY - 18; // body center, leaving room for the feet

  const shadow = svgEl("ellipse", { cx: 0, cy: 4, rx: 95, ry: 16, fill: c.shadow, class: "shadow" });

  const feet = svgEl("g", { class: "feet" }, [
    svgEl("ellipse", { cx: -42, cy: -8, rx: 26, ry: 14, fill: c.tomatoDark }),
    svgEl("ellipse", { cx: 42, cy: -8, rx: 26, ry: 14, fill: c.tomatoDark }),
  ]);

  const eye = (x: number) =>
    svgEl("g", { class: "eye" }, [
      svgEl("ellipse", { cx: x, cy: cy - 4, rx: 15, ry: 19, fill: c.ink }),
      svgEl("circle", { cx: x + 5, cy: cy - 10, r: 5, fill: c.white }),
      // Heavy eyelid: the default unimpressed look.
      svgEl("rect", { class: "lid", x: x - 18, y: cy - 26, width: 36, height: 19, fill: c.tomato }),
    ]);
  const eyes = svgEl("g", { class: "eyes" }, [eye(-38), eye(38)]);

  const brows = svgEl("g", { class: "brows" }, [
    svgEl("path", { d: `M ${-60} ${cy - 40} L ${-20} ${cy - 30}`, stroke: c.ink, "stroke-width": 9, "stroke-linecap": "round" }),
    svgEl("path", { d: `M ${60} ${cy - 40} L ${20} ${cy - 30}`, stroke: c.ink, "stroke-width": 9, "stroke-linecap": "round" }),
  ]);

  const mouth = svgEl("path", {
    class: "mouth",
    d: `M -16 ${cy + 36} Q 0 ${cy + 26} 16 ${cy + 36}`,
    stroke: c.ink,
    "stroke-width": 7,
    "stroke-linecap": "round",
    fill: "none",
  });

  const cheeks = svgEl("g", { class: "cheeks", opacity: 0 }, [
    svgEl("ellipse", { cx: -70, cy: cy + 22, rx: 18, ry: 10, fill: c.blush }),
    svgEl("ellipse", { cx: 70, cy: cy + 22, rx: 18, ry: 10, fill: c.blush }),
  ]);

  const top = cy - BODY_RY + 6;
  const leaf = (angle: number) =>
    svgEl("path", {
      d: `M 0 ${top} q 18 -10 52 4 q -30 14 -52 -4 z`,
      fill: c.leaf,
      transform: `rotate(${angle} 0 ${top})`,
    });
  const stem = svgEl("g", { class: "stem" }, [
    leaf(-20), leaf(35), leaf(150), leaf(205), leaf(270),
    svgEl("rect", { x: -6, y: top - 30, width: 12, height: 34, rx: 6, fill: c.leafDark }),
  ]);

  const body = svgEl("g", { class: "body" }, [
    svgEl("ellipse", { cx: 0, cy, rx: BODY_RX, ry: BODY_RY, fill: c.tomato }),
    svgEl("ellipse", { cx: -80, cy: cy - 46, rx: 18, ry: 10, fill: c.tomatoLight, transform: `rotate(-40 -80 ${cy - 46})` }),
    cheeks,
    eyes,
    brows,
    mouth,
    stem,
  ]);

  const root = svgEl("g", { class: "tomatoshi" }, [shadow, feet, body]);
  return { root, body, eyes, brows, mouth, cheeks, stem };
}
