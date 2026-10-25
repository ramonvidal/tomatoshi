// The garden, out the back door: open sky, a fence, tomato plants (more
// cousins), a hammock, a sprinkler, butterflies, and a compost bin.

import type { SceneDef } from "../engine/room";
import { STAGE_HEIGHT, STAGE_WIDTH, svgEl } from "../engine/stage";
import { palette as c } from "../palette";

export const GROUND_Y = 820;
const BLEED = 1200;
/** The house wall the back door is in, on the left. */
const HOUSE_RIGHT = 135;

export const garden: SceneDef = {
  id: "garden",
  backdrop: "garden",
  walkArea: { minX: 120, maxX: 600, minY: 900, maxY: 1200 },
  start: { x: 380, y: 1080 },
  objects: [
    { id: "sky", type: "sky", x: 0, y: 0 },
    { id: "garden-door", type: "door", x: 62, y: GROUND_Y, state: { to: "living-room", locked: false } },
    { id: "compost", type: "compost", x: 214, y: 884 },
    { id: "garden-plant-1", type: "plant", x: 556, y: 866, state: { water: 70 } },
    { id: "garden-plant-2", type: "plant", x: 656, y: 872, state: { water: 55 } },
    { id: "hammock", type: "hammock", x: 400, y: 975 },
    { id: "sprinkler", type: "sprinkler", x: 150, y: 1170, state: { on: false } },
    { id: "butterfly-1", type: "critter", x: 500, y: 1000 },
    { id: "butterfly-2", type: "critter", x: 250, y: 1100 },
  ],
  triggers: [],
};

export function drawGarden(): SVGGElement {
  const wide = { x: -BLEED, width: STAGE_WIDTH + 2 * BLEED };

  // Bushes peeking over the fence.
  const bushes = [-60, 120, 300, 480, 660, 840].map((x, i) =>
    svgEl("g", {}, [
      svgEl("circle", { cx: x, cy: 720, r: 70 + (i % 2) * 18, fill: i % 2 ? c.bushDark : c.bush }),
      svgEl("circle", { cx: x + 70, cy: 735, r: 55, fill: c.bush }),
    ]),
  );

  // Picket fence along the horizon.
  const pickets: SVGElement[] = [];
  for (let x = -BLEED; x < STAGE_WIDTH + BLEED; x += 34) {
    pickets.push(svgEl("path", { d: `M ${x} ${GROUND_Y} L ${x} 712 L ${x + 11} 700 L ${x + 22} 712 L ${x + 22} ${GROUND_Y} Z`, fill: c.fence }));
  }

  // Grass stripes, wider toward the front.
  const stripes: SVGElement[] = [];
  let y = GROUND_Y;
  for (let row = 0; y < STAGE_HEIGHT + BLEED; row++) {
    const h = 40 + row * 14;
    if (row % 2) stripes.push(svgEl("rect", { ...wide, y, height: h, fill: c.grassDark }));
    y += h;
  }

  // Clover-ish tufts.
  const tufts = Array.from({ length: 14 }, (_, i) => {
    const tx = (i * 173) % 700 + 10;
    const ty = 930 + ((i * 97) % 300);
    return svgEl("path", { d: `M ${tx} ${ty} l 4 -12 l 4 12 l 4 -9 l 3 9`, stroke: c.grassFar, "stroke-width": 3, fill: "none", "stroke-linecap": "round" });
  });

  // The back of the house, with siding.
  const siding = Array.from({ length: 40 }, (_, i) =>
    svgEl("rect", { x: -BLEED, y: GROUND_Y - 30 - i * 30, width: BLEED + HOUSE_RIGHT, height: 3, fill: c.houseWallLine }),
  );

  return svgEl("g", { class: "scene garden" }, [
    ...bushes,
    svgEl("rect", { ...wide, y: 760, height: 10, fill: c.fenceShade }),
    ...pickets,
    svgEl("rect", { ...wide, y: GROUND_Y, height: STAGE_HEIGHT - GROUND_Y + BLEED, fill: c.grass }),
    ...stripes,
    ...tufts,
    // A stepping-stone path from the back door.
    ...[0, 1, 2, 3].map((i) => svgEl("ellipse", { cx: 90 + i * 70, cy: 900 + i * 70, rx: 38 + i * 4, ry: 14 + i * 2, fill: c.path })),
    svgEl("rect", { x: -BLEED, y: -BLEED, width: BLEED + HOUSE_RIGHT, height: GROUND_Y + BLEED, fill: c.houseWall }),
    ...siding,
    svgEl("rect", { x: HOUSE_RIGHT - 6, y: -BLEED, width: 10, height: GROUND_Y + BLEED, fill: c.houseWallLine }),
  ]);
}
