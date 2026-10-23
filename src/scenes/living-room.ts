// Placeholder living room art. Objects become data-driven, interactive
// props in M2; for now this is just the backdrop.

import { STAGE_HEIGHT, STAGE_WIDTH, svgEl } from "../engine/stage";
import type { Area } from "../friend/brain";
import { palette as c } from "../palette";

export const FLOOR_Y = 820;

/** Where Tomatoshi's feet can be. Keeps its whole body on screen. */
export const WALK_AREA: Area = { minX: 120, maxX: 600, minY: 900, maxY: 1200 };

/** How far the backdrop extends past the stage to fill taller/wider screens. */
const BLEED = 1200;

export function drawLivingRoom(): SVGGElement {
  const wallStripes = Array.from({ length: 9 + 2 * Math.ceil(BLEED / 90) }, (_, i) =>
    svgEl("rect", { x: (i - Math.ceil(BLEED / 90)) * 90 + 30, y: -BLEED, width: 30, height: FLOOR_Y + BLEED, fill: c.wallStripe }),
  );

  const floorLines = Array.from({ length: 6 }, (_, i) => {
    const y = FLOOR_Y + 40 + i * i * 14 + i * 30;
    return svgEl("rect", { x: -BLEED, y, width: STAGE_WIDTH + 2 * BLEED, height: 4, fill: c.floorLine });
  });

  const window = svgEl("g", { class: "window" }, [
    svgEl("rect", { x: 380, y: 200, width: 260, height: 300, rx: 16, fill: c.windowFrame }),
    svgEl("rect", { x: 396, y: 216, width: 228, height: 268, rx: 8, fill: c.sky }),
    svgEl("rect", { x: 504, y: 216, width: 12, height: 268, fill: c.windowFrame }),
    svgEl("rect", { x: 396, y: 344, width: 228, height: 12, fill: c.windowFrame }),
  ]);

  const couch = svgEl("g", { class: "couch" }, [
    svgEl("rect", { x: 30, y: 600, width: 300, height: 150, rx: 40, fill: c.couchDark }),
    svgEl("rect", { x: 50, y: 700, width: 260, height: 90, rx: 24, fill: c.couch }),
    svgEl("rect", { x: 10, y: 680, width: 60, height: 140, rx: 28, fill: c.couch }),
    svgEl("rect", { x: 290, y: 680, width: 60, height: 140, rx: 28, fill: c.couch }),
    svgEl("rect", { x: 50, y: 816, width: 20, height: 24, rx: 6, fill: c.couchDark }),
    svgEl("rect", { x: 290, y: 816, width: 20, height: 24, rx: 6, fill: c.couchDark }),
  ]);

  const rug = svgEl("g", { class: "rug" }, [
    svgEl("ellipse", { cx: 360, cy: 1060, rx: 300, ry: 110, fill: c.rug }),
    svgEl("ellipse", { cx: 360, cy: 1060, rx: 240, ry: 80, fill: c.rugInner }),
  ]);

  return svgEl("g", { class: "scene living-room" }, [
    svgEl("rect", { x: -BLEED, y: -BLEED, width: STAGE_WIDTH + 2 * BLEED, height: FLOOR_Y + BLEED, fill: c.wall }),
    ...wallStripes,
    window,
    svgEl("rect", { x: -BLEED, y: FLOOR_Y, width: STAGE_WIDTH + 2 * BLEED, height: STAGE_HEIGHT - FLOOR_Y + BLEED, fill: c.floor }),
    ...floorLines,
    svgEl("rect", { x: -BLEED, y: FLOOR_Y - 24, width: STAGE_WIDTH + 2 * BLEED, height: 24, fill: c.baseboard }),
    rug,
    couch,
  ]);
}
