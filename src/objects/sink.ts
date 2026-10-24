// Kitchen sink: tap to run the water. Tomatoshi hops in for a bath:
// annoyed at first, then (secretly) enjoying it.

import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Prop, type PropFactory } from "./prop";

/** How long the tap runs after being turned on. */
const RUN_TIME = 3;

export const createSink: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { ...def.state });

  const stream = svgEl("rect", { x: 14, y: -54, width: 7, height: 64, rx: 3, fill: "#9fd3ff", opacity: 0.85, display: "none" });
  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    svgEl("ellipse", { cx: 0, cy: 6, rx: 66, ry: 15, fill: c.sinkRim }),
    svgEl("ellipse", { cx: 0, cy: 7, rx: 56, ry: 11, fill: c.sinkInside }),
    // Faucet: up from the back of the counter and over the basin.
    svgEl("path", { d: "M 38 -2 L 38 -58 Q 38 -70 26 -70 L 18 -70 L 18 -56", stroke: c.metal, "stroke-width": 9, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }),
    svgEl("rect", { x: 46, y: -26, width: 18, height: 8, rx: 4, fill: c.metal }),
    stream,
  ]);
  tagProp(root, def.id, def.type);

  let running = 0;

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y + 190,
    update(dt) {
      running = Math.max(0, running - dt);
      stream.setAttribute("display", running > 0 ? "inline" : "none");
      if (running > 0 && Math.floor(running * 12) !== Math.floor((running + dt) * 12)) {
        ctx.fx("drop", def.x + 18 + (ctx.rng() - 0.5) * 30, def.y + 4);
      }
    },
    handle(g) {
      if (g.type !== "tap") return;
      running = RUN_TIME;
      emitProp(ctx, def.id, "splashed");
    },
    opportunities: () => [{ propId: def.id, action: "bathe", weight: 0.6 }],
    spot: (action) => (action === "bathe" ? { x: def.x, y: ctx.area.minY } : null),
    // Feet go into the basin, a little below the counter top.
    seatHeight: () => ctx.area.minY - (def.y + 14),
    use(action) {
      if (action === "bathe") running = RUN_TIME;
    },
    focus: () => ({ x: def.x + 18, y: def.y - 50 }),
  };
  return prop;
};
