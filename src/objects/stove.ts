// Stove: tap to light the burners. Far too hot for a tomato.

import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Prop, type PropFactory } from "./prop";

export const createStove: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { on: false, ...def.state });
  const isOn = () => ctx.world.value<boolean>(def.id, "on");

  const flame = (x: number) =>
    svgEl("path", { d: `M ${x - 16} 0 Q ${x - 10} -18 ${x - 4} -8 Q ${x} -26 ${x + 5} -8 Q ${x + 10} -18 ${x + 16} 0 Z`, fill: c.flame });
  const flames = svgEl("g", { display: "none" }, [flame(-30), flame(30)]);
  const knob = (x: number) => svgEl("circle", { cx: x, cy: 34, r: 7, fill: c.lampMetal });

  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    svgEl("rect", { x: -64, y: -4, width: 128, height: 10, rx: 3, fill: c.stoveTop }),
    svgEl("ellipse", { cx: -30, cy: 0, rx: 22, ry: 5, fill: c.lampMetal }),
    svgEl("ellipse", { cx: 30, cy: 0, rx: 22, ry: 5, fill: c.lampMetal }),
    flames,
    // Oven front, in the cabinet below.
    svgEl("rect", { x: -60, y: 20, width: 120, height: 158, rx: 8, fill: c.stoveFront }),
    knob(-36), knob(-12), knob(12), knob(36),
    svgEl("rect", { x: -44, y: 62, width: 88, height: 70, rx: 8, fill: c.tvScreen }),
    svgEl("rect", { x: -36, y: 144, width: 72, height: 8, rx: 4, fill: c.metal }),
  ]);
  tagProp(root, def.id, def.type);

  let time = 0;

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y + 190,
    update(dt) {
      time += dt;
      const on = isOn();
      flames.setAttribute("display", on ? "inline" : "none");
      if (on) flames.setAttribute("transform", `translate(0 ${(-Math.abs(Math.sin(time * 9)) * 2).toFixed(1)}) scale(1 ${(1 + Math.sin(time * 13) * 0.12).toFixed(3)})`);
    },
    handle(g) {
      if (g.type !== "tap") return;
      ctx.world.set(def.id, { on: !isOn() });
      emitProp(ctx, def.id, "toggled");
    },
    ambientLight: () => (isOn() ? 0.05 : 0),
    lightSource: () => (isOn() ? { x: def.x, y: def.y - 10, radius: 220, tone: "warm" } : null),
    danger: () => (isOn() ? { x: def.x, y: ctx.area.minY, radius: 100, kind: "hot" } : null),
  };
  return prop;
};
