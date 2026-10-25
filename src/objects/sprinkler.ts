// Garden sprinkler: tap to turn it on. Tomatoshi says it hates getting wet.
// It hops around in the spray anyway.

import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Prop, type PropFactory } from "./prop";

/** How far the spray reaches on the ground. */
const REACH = 160;

export const createSprinkler: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { on: false, ...def.state });
  const isOn = () => ctx.world.value<boolean>(def.id, "on");

  const head = svgEl("g", {}, [
    svgEl("rect", { x: -16, y: -40, width: 32, height: 10, rx: 5, fill: c.metal }),
    svgEl("circle", { cx: 0, cy: -35, r: 8, fill: c.ball }),
  ]);
  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    // Big invisible touch area.
    svgEl("circle", { cx: 0, cy: -20, r: 50, fill: "transparent" }),
    svgEl("ellipse", { cx: 0, cy: -2, rx: 34, ry: 8, fill: c.shadow }),
    svgEl("path", { d: "M -24 0 L -14 -28 L 14 -28 L 24 0 Z", fill: c.sprinkler }),
    head,
    svgEl("path", { d: "M 24 -4 Q 80 10 140 -6", stroke: c.hose, "stroke-width": 7, fill: "none", "stroke-linecap": "round" }),
  ]);
  tagProp(root, def.id, def.type);

  let time = 0;

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y,
    update(dt) {
      time += dt;
      if (!isOn()) return;
      // The head sweeps side to side; drops fall in an arc around it.
      const sweep = Math.sin(time * 2.4);
      head.setAttribute("transform", `rotate(${(sweep * 35).toFixed(1)} 0 -35)`);
      if (Math.floor(time * 30) !== Math.floor((time - dt) * 30)) {
        const angle = -Math.PI / 2 + sweep * 1.2 + (ctx.rng() - 0.5) * 0.4;
        const dist = 30 + ctx.rng() * REACH;
        ctx.fx("drop", def.x + Math.cos(angle) * dist, def.y - 40 - Math.abs(Math.sin(angle)) * 90 * (1 - dist / (REACH + 40)));
      }
    },
    handle(g) {
      if (g.type !== "tap") return;
      ctx.world.set(def.id, { on: !isOn() });
      emitProp(ctx, def.id, "toggled");
    },
    opportunities: () => [{ propId: def.id, action: "play", weight: isOn() ? 1 : 0 }],
    spot: (action) =>
      action === "play" && isOn()
        ? { x: Math.min(ctx.area.maxX, Math.max(ctx.area.minX, def.x + 90)), y: Math.min(ctx.area.maxY, def.y - 30) }
        : null,
    catchDrop: (p) => (isOn() && Math.hypot(p.x - def.x, p.y - (def.y - 120)) < REACH ? "play" : null),
    focus: () => ({ x: def.x, y: def.y - 40 }),
    danger: () => (isOn() ? { x: def.x, y: def.y, radius: REACH, kind: "wet" } : null),
  };
  return prop;
};
