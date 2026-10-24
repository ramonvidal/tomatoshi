// Crate of vegetables: an onion and a cucumber, Tomatoshi's neighbors. It
// likes grumbling at them. Tap the crate and the onion stings everyone's eyes.

import { Spring } from "../engine/spring";
import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Prop, type PropFactory } from "./prop";

/** How long the onion's sting lingers (seconds). */
const STING = 4;

export const createVeggies: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { ...def.state });

  const eyes = (x: number, y: number) => [
    svgEl("path", { d: `M ${x - 9} ${y} l 6 0 M ${x + 3} ${y} l 6 0`, stroke: c.ink, "stroke-width": 3, "stroke-linecap": "round" }),
  ];
  const onion = svgEl("g", {}, [
    svgEl("path", { d: "M -30 -40 Q -60 -40 -58 -70 Q -55 -96 -30 -110 Q -5 -96 -2 -70 Q 0 -40 -30 -40 Z", fill: c.onion }),
    svgEl("path", { d: "M -30 -110 L -30 -124", stroke: c.leafDark, "stroke-width": 4, "stroke-linecap": "round" }),
    ...eyes(-30, -76),
  ]);
  const cucumber = svgEl("g", {}, [
    svgEl("rect", { x: 6, y: -128, width: 40, height: 96, rx: 20, fill: c.cucumber, transform: "rotate(12 26 -80)" }),
    ...eyes(28, -96),
  ]);
  const tears = svgEl("g", { display: "none" }, [
    svgEl("path", { d: "M -38 -70 q -3 8 0 12 q 3 -4 0 -12 Z M -22 -70 q -3 8 0 12 q 3 -4 0 -12 Z", fill: "#9fd3ff" }),
  ]);
  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    svgEl("ellipse", { cx: 0, cy: -2, rx: 72, ry: 10, fill: c.shadow }),
    onion,
    tears,
    cucumber,
    svgEl("rect", { x: -70, y: -50, width: 140, height: 50, rx: 6, fill: c.wood }),
    svgEl("rect", { x: -70, y: -34, width: 140, height: 6, fill: c.woodDark }),
    svgEl("rect", { x: -70, y: -16, width: 140, height: 6, fill: c.woodDark }),
  ]);
  tagProp(root, def.id, def.type);

  const bob = new Spring(220, 8);
  let sting = 0;

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y,
    update(dt) {
      sting = Math.max(0, sting - dt);
      const y = Math.max(0, bob.update(dt)) * -12;
      onion.setAttribute("transform", `translate(0 ${y.toFixed(1)})`);
      cucumber.setAttribute("transform", `translate(0 ${(y * 0.6).toFixed(1)})`);
      tears.setAttribute("display", sting > 0 ? "inline" : "none");
    },
    handle(g) {
      if (g.type !== "tap") return;
      bob.kick(4);
      sting = STING;
      emitProp(ctx, def.id, "onion");
    },
    opportunities: () => [{ propId: def.id, action: "grumble", weight: 0.6 }],
    spot: (action) =>
      action === "grumble"
        ? { x: Math.max(ctx.area.minX, def.x - 150), y: Math.min(ctx.area.maxY, def.y - 10) }
        : null,
    focus: () => ({ x: def.x, y: def.y - 80 }),
    danger: () => (sting > 0 ? { x: def.x, y: def.y, radius: 260, kind: "onion" } : null),
  };
  return prop;
};
