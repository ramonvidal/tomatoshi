// Snack bowl: tap to refill. Tomatoshi eats from it (grudgingly), and
// glares at you when it finds it empty.

import { Spring } from "../engine/spring";
import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Prop, type PropFactory } from "./prop";

export const MAX_FOOD = 3;
/** Where Tomatoshi stands to eat, relative to the bowl. */
const EAT_OFFSET = { x: -125, y: -6 };
const SNACK_POSITIONS = [
  [-20, -44],
  [14, -46],
  [-2, -56],
] as const;

export const createBowl: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { food: MAX_FOOD, ...def.state });
  const food = () => ctx.world.value<number>(def.id, "food");

  const pieces = SNACK_POSITIONS.map(([x, y], i) => {
    const g = svgEl("g", {}, [
      svgEl("circle", { cx: x, cy: y, r: 13, fill: c.snack }),
      svgEl("circle", { cx: x - 4, cy: y - 3, r: 2.5, fill: c.snackDark }),
      svgEl("circle", { cx: x + 4, cy: y + 2, r: 2.5, fill: c.snackDark }),
    ]);
    const pop = new Spring(300, 14, i < food() ? 1 : 0);
    pop.value = pop.target;
    return { g, x, y, pop };
  });

  const wiggler = svgEl("g", {}, [
    svgEl("ellipse", { cx: 0, cy: -44, rx: 58, ry: 14, fill: c.bowlInside }),
    ...pieces.map((p) => p.g),
    svgEl("path", { d: "M -60 -44 Q -56 0 0 0 Q 56 0 60 -44 Q 30 -30 0 -30 Q -30 -30 -60 -44 Z", fill: c.bowl }),
    svgEl("path", { d: "M -44 -24 Q -20 -14 6 -16", stroke: c.bowlDark, "stroke-width": 5, "stroke-linecap": "round", fill: "none" }),
  ]);
  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    svgEl("ellipse", { cx: 0, cy: -2, rx: 50, ry: 8, fill: c.shadow }),
    wiggler,
  ]);
  tagProp(root, def.id, def.type);

  const wiggle = new Spring(200, 8);

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y,
    update(dt) {
      const n = food();
      pieces.forEach((p, i) => {
        // Snacks pop in (with overshoot) when refilled, shrink away when eaten.
        p.pop.target = i < n ? 1 : 0;
        const s = Math.max(0, p.pop.update(dt));
        p.g.setAttribute("display", s < 0.02 ? "none" : "inline");
        p.g.setAttribute("transform", `translate(${p.x} ${p.y}) scale(${s.toFixed(3)}) translate(${-p.x} ${-p.y})`);
      });
      wiggler.setAttribute("transform", `rotate(${wiggle.update(dt).toFixed(2)} 0 0)`);
    },
    handle(g) {
      if (g.type !== "tap") return;
      wiggle.kick(60);
      if (food() < MAX_FOOD) {
        ctx.world.set(def.id, { food: MAX_FOOD });
        emitProp(ctx, def.id, "refilled");
      }
    },
    opportunities: () => [
      { propId: def.id, action: "eat", weight: food() > 0 ? 1.2 : 0 },
      { propId: def.id, action: "inspect", weight: food() > 0 ? 0 : 0.6 },
    ],
    spot: (action) =>
      action === "eat" || action === "inspect" ? { x: def.x + EAT_OFFSET.x, y: def.y + EAT_OFFSET.y } : null,
    use(action) {
      if (action !== "eat" || food() <= 0) return;
      const left = food() - 1;
      ctx.world.set(def.id, { food: left });
      wiggle.kick(25);
      if (left === 0) emitProp(ctx, def.id, "emptied");
    },
    focus: () => ({ x: def.x, y: def.y - 40 }),
  };
  return prop;
};
