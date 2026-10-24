// Ceiling light: tap it to switch it on or off.

import { Spring } from "../engine/spring";
import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Prop, type PropFactory } from "./prop";

export const createPendant: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { on: false, ...def.state });
  const isOn = () => ctx.world.value<boolean>(def.id, "on");

  const bulb = svgEl("circle", { cx: 0, cy: 4, r: 12, fill: c.bulb });
  const shade = svgEl("path", { d: "M -46 0 Q -46 -44 0 -44 Q 46 -44 46 0 Z", fill: c.lampShade });
  const swing = svgEl("g", {}, [
    svgEl("rect", { x: -2, y: -1600, width: 4, height: 1560, fill: c.lampMetal }),
    bulb,
    shade,
  ]);
  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    // Big invisible touch area around the shade.
    svgEl("rect", { x: -70, y: -120, width: 140, height: 150, fill: "transparent" }),
    swing,
  ]);
  tagProp(root, def.id, def.type);

  const sway = new Spring(30, 1.5);
  let shown: boolean | null = null;

  const prop: Prop = {
    id: def.id,
    layer: "wall",
    root,
    sortY: () => def.y,
    update(dt) {
      swing.setAttribute("transform", `rotate(${sway.update(dt).toFixed(2)} 0 -1600)`);
      const on = isOn();
      if (on !== shown) {
        shown = on;
        shade.setAttribute("fill", on ? c.lampShadeLit : c.lampShade);
        bulb.setAttribute("display", on ? "inline" : "none");
      }
    },
    handle(g) {
      if (g.type !== "tap") return;
      ctx.world.set(def.id, { on: !isOn() });
      sway.kick(3);
      emitProp(ctx, def.id, "toggled");
    },
    ambientLight: () => (isOn() ? 0.6 : 0),
    lightSource: () => (isOn() ? { x: def.x, y: def.y + 20, radius: 560, tone: "warm" } : null),
  };
  return prop;
};
