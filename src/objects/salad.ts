// Salad bowl, with tomato slices in it. Deeply offensive.

import { Spring } from "../engine/spring";
import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { tagProp, type Prop, type PropFactory } from "./prop";

export const createSalad: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { ...def.state });

  const leaf = (x: number, y: number, a: number) =>
    svgEl("ellipse", { cx: x, cy: y, rx: 16, ry: 9, fill: c.leaf, transform: `rotate(${a} ${x} ${y})` });
  const slice = (x: number, y: number) =>
    svgEl("g", {}, [
      svgEl("circle", { cx: x, cy: y, r: 10, fill: c.tomato }),
      svgEl("circle", { cx: x, cy: y, r: 6, fill: c.tomatoLight }),
      svgEl("circle", { cx: x - 2, cy: y - 1, r: 1.5, fill: c.snack }),
      svgEl("circle", { cx: x + 2, cy: y + 2, r: 1.5, fill: c.snack }),
    ]);
  const salad = svgEl("g", {}, [leaf(-24, -24, -30), leaf(20, -26, 25), leaf(0, -32, 5), slice(-8, -26), slice(14, -20), leaf(-6, -18, 60)]);
  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    salad,
    svgEl("path", { d: "M -40 -18 Q -36 6 0 6 Q 36 6 40 -18 Z", fill: c.white }),
    svgEl("path", { d: "M -30 -8 Q -10 0 10 -2", stroke: c.bowlInside, "stroke-width": 3, fill: "none", "stroke-linecap": "round", opacity: 0.4 }),
  ]);
  tagProp(root, def.id, def.type);

  const toss = new Spring(260, 9);

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y + 190,
    update(dt) {
      salad.setAttribute("transform", `translate(0 ${(-Math.max(0, toss.update(dt)) * 14).toFixed(1)})`);
    },
    handle(g) {
      if (g.type === "tap") toss.kick(4);
    },
    danger: () => ({ x: def.x, y: ctx.area.minY, radius: 75, kind: "offensive" }),
  };
  return prop;
};
