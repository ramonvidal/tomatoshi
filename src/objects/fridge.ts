// Fridge: tap to open or close. Cold air spills out, which Tomatoshi hates,
// but it's also where the snacks are. Hungry and the door's shut? It glares.

import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Prop, type PropFactory } from "./prop";

const W = 170;
const H = 440;
export const FRIDGE_SNACKS = 3;

export const createFridge: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { open: false, snacks: FRIDGE_SNACKS, ...def.state });
  const isOpen = () => ctx.world.value<boolean>(def.id, "open");
  const snacks = () => ctx.world.value<number>(def.id, "snacks");

  const left = -W / 2;
  const items = [0, 1, 2].map((i) =>
    svgEl("g", {}, [
      svgEl("rect", { x: left + 24 + i * 40, y: -228, width: 28, height: 30, rx: 6, fill: c.bowl }),
      svgEl("circle", { cx: left + 38 + i * 40, cy: -238, r: 10, fill: c.snack }),
    ]),
  );
  const inside = svgEl("g", {}, [
    svgEl("rect", { x: left + 8, y: -H + 150, width: W - 16, height: H - 166, rx: 8, fill: c.fridgeInside }),
    ...[-300, -196, -100].map((y) => svgEl("rect", { x: left + 12, y, width: W - 24, height: 6, rx: 3, fill: c.fridgeShelf })),
    svgEl("rect", { x: left + 30, y: -150, width: 34, height: 46, rx: 6, fill: c.ballStripe }),
    svgEl("rect", { x: left + 96, y: -140, width: 20, height: 36, rx: 4, fill: c.leaf }),
    ...items,
  ]);
  // The door swings open on its left hinge.
  const door = svgEl("g", {}, [
    svgEl("rect", { x: left, y: -H + 140, width: W, height: H - 140, rx: 14, fill: c.fridge }),
    svgEl("rect", { x: W / 2 - 26, y: -H + 170, width: 10, height: 110, rx: 5, fill: c.metal }),
  ]);
  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    svgEl("rect", { x: left, y: -H, width: W, height: H, rx: 16, fill: c.fridgeDark }),
    // Freezer on top (stays shut).
    svgEl("rect", { x: left, y: -H, width: W, height: 132, rx: 14, fill: c.fridge }),
    svgEl("rect", { x: W / 2 - 26, y: -H + 30, width: 10, height: 70, rx: 5, fill: c.metal }),
    inside,
    door,
  ]);
  tagProp(root, def.id, def.type);

  let openness = isOpen() ? 1 : 0;
  let time = 0;

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y,
    update(dt) {
      time += dt;
      const open = isOpen();
      openness += ((open ? 1 : 0) - openness) * (1 - Math.exp(-8 * dt));
      door.setAttribute("transform", `translate(${left} 0) scale(${(1 - openness * 0.82).toFixed(3)} 1) translate(${-left} 0)`);
      inside.setAttribute("display", openness > 0.05 ? "inline" : "none");
      items.forEach((el, i) => el.setAttribute("display", i < snacks() ? "inline" : "none"));
      // Cold air rolls out of the open door.
      if (open && Math.floor(time * 4) !== Math.floor((time - dt) * 4)) ctx.fx("steam", def.x - 20 + (ctx.rng() - 0.5) * 80, def.y - 60);
    },
    handle(g) {
      if (g.type !== "tap") return;
      const opening = !isOpen();
      // Opening an empty fridge: it's been restocked (someone went shopping).
      ctx.world.set(def.id, opening && snacks() === 0 ? { open: true, snacks: FRIDGE_SNACKS } : { open: opening });
      emitProp(ctx, def.id, "toggled");
    },
    opportunities: () => [
      { propId: def.id, action: "eat", weight: isOpen() && snacks() > 0 ? 1.2 : 0 },
      { propId: def.id, action: "inspect", weight: !isOpen() && snacks() > 0 ? 0.5 : 0 },
    ],
    spot: (action) =>
      action === "eat" || action === "inspect" ? { x: Math.min(ctx.area.maxX, def.x - 70), y: ctx.area.minY + 10 } : null,
    use(action) {
      if (action !== "eat" || !isOpen() || snacks() <= 0) return;
      ctx.world.set(def.id, { snacks: snacks() - 1 });
    },
    focus: () => ({ x: def.x - 20, y: def.y - 220 }),
    ambientLight: () => (isOpen() ? 0.15 : 0),
    lightSource: () => (isOpen() ? { x: def.x, y: def.y - 200, radius: 320, tone: "cool" } : null),
    danger: () => (isOpen() ? { x: def.x - 40, y: ctx.area.minY, radius: 120, kind: "cold" } : null),
  };
  return prop;
};
