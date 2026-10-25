// Compost bin: where vegetables go when it's over. Tomatoshi keeps well away.
// Tap it to open the lid, which is just mean.

import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Prop, type PropFactory } from "./prop";

export const createCompost: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { ...def.state });

  const lid = svgEl("rect", { x: -52, y: -122, width: 104, height: 14, rx: 6, fill: c.compostDark });
  const stink = svgEl(
    "g",
    { display: "none" },
    [-20, 0, 20].map((dx) => svgEl("path", { d: `M ${dx} -130 q 8 -12 0 -24 q -8 -12 0 -24`, stroke: c.stink, "stroke-width": 4, fill: "none", "stroke-linecap": "round" })),
  );
  const flies = [0, 1].map(() => svgEl("circle", { r: 3, fill: c.ink }));
  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    svgEl("ellipse", { cx: 0, cy: -2, rx: 52, ry: 9, fill: c.shadow }),
    svgEl("path", { d: "M -46 -110 L 46 -110 L 40 0 L -40 0 Z", fill: c.compost }),
    svgEl("rect", { x: -40, y: -80, width: 80, height: 6, rx: 3, fill: c.compostDark }),
    svgEl("rect", { x: -38, y: -44, width: 76, height: 6, rx: 3, fill: c.compostDark }),
    stink,
    lid,
    ...flies,
  ]);
  tagProp(root, def.id, def.type);

  let open = 0;
  let time = 0;

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y,
    update(dt) {
      time += dt;
      open = Math.max(0, open - dt);
      lid.setAttribute("transform", open > 0 ? "rotate(-35 -52 -115)" : "");
      stink.setAttribute("display", open > 0 ? "inline" : "none");
      flies.forEach((fly, i) => {
        const a = time * (3 + i) + i * 2;
        fly.setAttribute("cx", (Math.cos(a) * (30 + i * 10)).toFixed(1));
        fly.setAttribute("cy", (-140 + Math.sin(a * 1.3) * 14).toFixed(1));
      });
    },
    handle(g) {
      if (g.type !== "tap") return;
      open = 2;
      emitProp(ctx, def.id, "opened");
    },
    focus: () => ({ x: def.x, y: def.y - 80 }),
    danger: () => ({ x: def.x, y: Math.max(def.y, ctx.area.minY), radius: 95, kind: "scary" }),
  };
  return prop;
};
