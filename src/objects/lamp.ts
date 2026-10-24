// Floor lamp: tap to switch it on or off. Lights a warm pool around it.

import { Spring } from "../engine/spring";
import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Prop, type PropFactory } from "./prop";

const SHADE_Y = -275;

export const createLamp: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { on: false, ...def.state });
  const isOn = () => ctx.world.value<boolean>(def.id, "on");

  const shade = svgEl("path", { d: "M -35 -350 L 35 -350 L 66 -270 L -66 -270 Z", fill: c.lampShade });
  const bulb = svgEl("circle", { cx: 0, cy: -262, r: 14, fill: c.bulb });
  const wobbler = svgEl("g", {}, [
    svgEl("rect", { x: -5, y: -300, width: 10, height: 296, rx: 5, fill: c.lampMetal }),
    bulb,
    shade,
    svgEl("path", { d: "M 34 -270 L 34 -232", stroke: c.lampMetal, "stroke-width": 3 }),
    svgEl("circle", { cx: 34, cy: -228, r: 6, fill: c.lampMetal }),
  ]);
  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    // Generous invisible hit area: the lamp is thin and easy to miss.
    svgEl("rect", { x: -75, y: -360, width: 150, height: 370, fill: "transparent" }),
    svgEl("ellipse", { cx: 0, cy: -6, rx: 42, ry: 12, fill: c.lampMetal }),
    wobbler,
  ]);
  tagProp(root, def.id, def.type);

  const wobble = new Spring(120, 5);
  let shown: boolean | null = null;

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y,
    update(dt) {
      wobbler.setAttribute("transform", `rotate(${wobble.update(dt).toFixed(2)} 0 -6)`);
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
      wobble.kick(40);
      emitProp(ctx, def.id, "toggled");
    },
    ambientLight: () => (isOn() ? 0.55 : 0),
    lightSource: () => (isOn() ? { x: def.x, y: def.y + SHADE_Y, radius: 480, tone: "warm" } : null),
  };
  return prop;
};
