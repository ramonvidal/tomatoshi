// The kitchen: dangerous for a tomato. Backdrop art plus the scene definition.

import type { SceneDef } from "../engine/room";
import { STAGE_HEIGHT, STAGE_WIDTH, svgEl } from "../engine/stage";
import { palette as c } from "../palette";

export const FLOOR_Y = 820;
/** Top of the counter, where the sink, knives, salad and stove sit. */
export const COUNTER_Y = 640;
const COUNTER = { left: 125, right: 550 };
const BLEED = 1200;

export const kitchen: SceneDef = {
  id: "kitchen",
  backdrop: "kitchen",
  walkArea: { minX: 120, maxX: 600, minY: 900, maxY: 1200 },
  start: { x: 330, y: 1060 },
  objects: [
    { id: "kitchen-door", type: "door", x: 62, y: FLOOR_Y, state: { to: "living-room", locked: false } },
    { id: "kitchen-window", type: "window", x: 150, y: 290, w: 190, h: 210, state: { curtainsOpen: true } },
    { id: "kitchen-light", type: "pendant", x: 360, y: 230, state: { on: false } },
    { id: "sink", type: "sink", x: 245, y: COUNTER_Y },
    { id: "knives", type: "knives", x: 345, y: COUNTER_Y },
    { id: "salad", type: "salad", x: 412, y: COUNTER_Y },
    { id: "stove", type: "stove", x: 487, y: COUNTER_Y, state: { on: false } },
    { id: "fridge", type: "fridge", x: 628, y: FLOOR_Y, state: { open: false, snacks: 3 } },
    { id: "veggies", type: "veggies", x: 600, y: 1198 },
  ],
  triggers: [],
};

export function drawKitchen(): SVGGElement {
  const wide = { x: -BLEED, width: STAGE_WIDTH + 2 * BLEED };

  // Square wall tiles.
  const tiles: SVGElement[] = [];
  for (let x = -BLEED; x < STAGE_WIDTH + BLEED; x += 60) {
    tiles.push(svgEl("rect", { x, y: -BLEED, width: 3, height: FLOOR_Y + BLEED, fill: c.tileLine }));
  }
  for (let y = FLOOR_Y - 60; y > -BLEED; y -= 60) {
    tiles.push(svgEl("rect", { ...wide, y, height: 3, fill: c.tileLine }));
  }

  // Checkered floor, rows getting taller toward the front.
  const checks: SVGElement[] = [];
  let y = FLOOR_Y;
  for (let row = 0; y < STAGE_HEIGHT + BLEED; row++) {
    const h = 34 + row * 12;
    for (let col = -20; col < 30; col++) {
      if ((row + col) % 2 === 0) checks.push(svgEl("rect", { x: col * 80, y, width: 80, height: h, fill: c.kitchenFloorDark }));
    }
    y += h;
  }

  const cabinetDoors = [
    [140, 200],
    [290, 410],
  ].map(([l, r]) =>
    svgEl("g", {}, [
      svgEl("rect", { x: l, y: COUNTER_Y + 26, width: r - l, height: 140, rx: 8, fill: c.cabinetDark }),
      svgEl("rect", { x: l + (r - l) / 2 - 3, y: COUNTER_Y + 40, width: 6, height: 30, rx: 3, fill: c.metal }),
    ]),
  );

  return svgEl("g", { class: "scene kitchen" }, [
    svgEl("rect", { ...wide, y: -BLEED, height: FLOOR_Y + BLEED, fill: c.tile }),
    ...tiles,
    svgEl("rect", { ...wide, y: FLOOR_Y, height: STAGE_HEIGHT - FLOOR_Y + BLEED, fill: c.kitchenFloor }),
    ...checks,
    svgEl("rect", { ...wide, y: FLOOR_Y - 20, height: 20, fill: c.cabinetDark }),
    // Counter: cabinets below, a worktop on top.
    svgEl("rect", { x: COUNTER.left + 5, y: COUNTER_Y + 10, width: COUNTER.right - COUNTER.left - 10, height: FLOOR_Y - COUNTER_Y - 10, fill: c.cabinet }),
    ...cabinetDoors,
    svgEl("rect", { x: COUNTER.left, y: COUNTER_Y - 8, width: COUNTER.right - COUNTER.left, height: 20, rx: 4, fill: c.counter }),
  ]);
}
