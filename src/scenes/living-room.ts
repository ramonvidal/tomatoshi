// The living room: backdrop art plus the scene definition (pure data).

import type { SceneDef } from "../engine/room";
import { STAGE_HEIGHT, STAGE_WIDTH, svgEl } from "../engine/stage";
import { palette as c } from "../palette";

export const FLOOR_Y = 820;

/** How far the backdrop extends past the stage to fill taller/wider screens. */
const BLEED = 1200;

export const livingRoom: SceneDef = {
  id: "living-room",
  backdrop: "living-room",
  // Where Tomatoshi's feet can be. Keeps its whole body on screen.
  walkArea: { minX: 120, maxX: 600, minY: 900, maxY: 1200 },
  start: { x: 360, y: 1060 },
  objects: [
    { id: "window", type: "window", x: 380, y: 200, state: { curtainsOpen: true } },
    { id: "couch", type: "couch", x: 180, y: 840 },
    { id: "lamp", type: "lamp", x: 650, y: 872, state: { on: false } },
    { id: "ball", type: "ball", x: 470, y: 1120 },
    { id: "bowl", type: "bowl", x: 610, y: 1196, state: { food: 2 } },
    { id: "radio", type: "radio", x: 180, y: 520, state: { on: false } },
    { id: "tv", type: "tv", x: 72, y: 1238, state: { channel: 0 } },
    { id: "plant", type: "plant", x: 430, y: 864, state: { water: 80 } },
  ],
  exits: [],
  triggers: [],
};

export function drawLivingRoom(): SVGGElement {
  const wallStripes = Array.from({ length: 9 + 2 * Math.ceil(BLEED / 90) }, (_, i) =>
    svgEl("rect", { x: (i - Math.ceil(BLEED / 90)) * 90 + 30, y: -BLEED, width: 30, height: FLOOR_Y + BLEED, fill: c.wallStripe }),
  );

  const floorLines = Array.from({ length: 6 }, (_, i) => {
    const y = FLOOR_Y + 40 + i * i * 14 + i * 30;
    return svgEl("rect", { x: -BLEED, y, width: STAGE_WIDTH + 2 * BLEED, height: 4, fill: c.floorLine });
  });

  const rug = svgEl("g", { class: "rug" }, [
    svgEl("ellipse", { cx: 360, cy: 1060, rx: 300, ry: 110, fill: c.rug }),
    svgEl("ellipse", { cx: 360, cy: 1060, rx: 240, ry: 80, fill: c.rugInner }),
  ]);

  return svgEl("g", { class: "scene living-room" }, [
    svgEl("rect", { x: -BLEED, y: -BLEED, width: STAGE_WIDTH + 2 * BLEED, height: FLOOR_Y + BLEED, fill: c.wall }),
    ...wallStripes,
    svgEl("rect", { x: -BLEED, y: FLOOR_Y, width: STAGE_WIDTH + 2 * BLEED, height: STAGE_HEIGHT - FLOOR_Y + BLEED, fill: c.floor }),
    ...floorLines,
    svgEl("rect", { x: -BLEED, y: FLOOR_Y - 24, width: STAGE_WIDTH + 2 * BLEED, height: 24, fill: c.baseboard }),
    rug,
  ]);
}
