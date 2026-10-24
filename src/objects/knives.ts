// Knife block on the counter. Tomatoshi will not go near it. Tapping it
// rattles the knives, which is just cruel.

import { Spring } from "../engine/spring";
import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Prop, type PropFactory } from "./prop";

export const createKnives: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { ...def.state });

  const handle = (x: number, angle: number) =>
    svgEl("rect", { x: x - 5, y: -82, width: 10, height: 34, rx: 4, fill: c.ink, transform: `rotate(${angle} ${x} -50)` });
  const handles = svgEl("g", {}, [handle(-12, -14), handle(0, -4), handle(12, 8)]);
  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    handles,
    svgEl("path", { d: "M -28 0 L -20 -56 L 26 -48 L 30 0 Z", fill: c.wood }),
    svgEl("path", { d: "M -20 -56 L 26 -48 L 22 -40 L -18 -47 Z", fill: c.woodDark }),
  ]);
  tagProp(root, def.id, def.type);

  const shake = new Spring(500, 12);

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y + 190,
    update(dt) {
      handles.setAttribute("transform", `rotate(${shake.update(dt).toFixed(2)} 0 -50)`);
    },
    handle(g) {
      if (g.type !== "tap") return;
      shake.kick(60);
      emitProp(ctx, def.id, "rattled");
    },
    danger: () => ({ x: def.x, y: ctx.area.minY, radius: 85, kind: "sharp" }),
  };
  return prop;
};
