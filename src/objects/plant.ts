// Potted tomato plant: Tomatoshi's cousins. The only ones it's nice to.
// It dries out over time; tap to water it.

import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, inBox, tagProp, type Prop, type PropFactory } from "./prop";

/** Water lost per minute. Dry in about 40 minutes. */
const DRY_RATE = 2.5;
export const THIRSTY = 30;

export const waterAfter = (level: number, seconds: number) => Math.max(0, level - (DRY_RATE * seconds) / 60);

export const createPlant: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { water: 80, ...def.state });
  let water = ctx.world.value<number>(def.id, "water");

  const leaf = (x: number, y: number, angle: number) =>
    svgEl("ellipse", { cx: x, cy: y, rx: 22, ry: 10, fill: c.leaf, transform: `rotate(${angle} ${x} ${y})` });

  // A cousin: a small tomato with a kind face (sad when thirsty).
  const mouths: { el: SVGPathElement; smile: string; frown: string }[] = [];
  const cousin = (x: number, y: number, r: number) => {
    const smile = `M ${x - 4} ${y + 3} Q ${x} ${y + 7} ${x + 4} ${y + 3}`;
    const frown = `M ${x - 4} ${y + 6} Q ${x} ${y + 1} ${x + 4} ${y + 6}`;
    const mouth = svgEl("path", { d: smile, stroke: c.ink, "stroke-width": 2, "stroke-linecap": "round", fill: "none" });
    mouths.push({ el: mouth, smile, frown });
    const face = svgEl("g", {}, [
      svgEl("circle", { cx: x - 4, cy: y - 2, r: 1.8, fill: c.ink }),
      svgEl("circle", { cx: x + 4, cy: y - 2, r: 1.8, fill: c.ink }),
      mouth,
    ]);
    return svgEl("g", {}, [
      svgEl("path", { d: `M ${x} ${y - r} L ${x} ${y - r - 10}`, stroke: c.leafDark, "stroke-width": 3 }),
      svgEl("circle", { cx: x, cy: y, r, fill: c.tomato }),
      svgEl("path", { d: `M ${x - 7} ${y - r + 1} L ${x} ${y - r - 3} L ${x + 7} ${y - r + 1}`, stroke: c.leaf, "stroke-width": 3, fill: "none", "stroke-linejoin": "round" }),
      face,
    ]);
  };

  const foliage = svgEl("g", {}, [
    svgEl("path", { d: "M 0 -70 C -6 -120 10 -150 0 -205 M 0 -110 C 20 -125 30 -140 34 -160 M 0 -130 C -22 -140 -30 -160 -36 -175", stroke: c.leafDark, "stroke-width": 5, fill: "none", "stroke-linecap": "round" }),
    leaf(-22, -100, -25), leaf(22, -96, 25), leaf(-28, -150, -35), leaf(34, -140, 30), leaf(-10, -200, -60), leaf(14, -185, 50),
    cousin(-30, -122, 15),
    cousin(30, -168, 13),
    cousin(-36, -186, 11),
  ]);

  const can = svgEl("g", { display: "none" }, [
    svgEl("rect", { x: -40, y: -30, width: 46, height: 34, rx: 8, fill: c.ball }),
    svgEl("path", { d: "M 6 -22 L 34 -40", stroke: c.ball, "stroke-width": 7, "stroke-linecap": "round" }),
    svgEl("path", { d: "M -40 -24 Q -56 -14 -40 0", stroke: c.ball, "stroke-width": 5, fill: "none" }),
  ]);

  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    svgEl("ellipse", { cx: 0, cy: -2, rx: 44, ry: 8, fill: c.shadow }),
    foliage,
    svgEl("path", { d: "M -40 -70 L 40 -70 L 30 0 L -30 0 Z", fill: c.pot }),
    svgEl("rect", { x: -46, y: -80, width: 92, height: 16, rx: 5, fill: c.potDark }),
    can,
  ]);
  tagProp(root, def.id, def.type);

  let pouring = 0;
  let shownThirsty: boolean | null = null;

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y,
    update(dt) {
      water = waterAfter(water, dt);
      const rounded = Math.round(water);
      if (rounded !== ctx.world.value<number>(def.id, "water")) ctx.world.set(def.id, { water: rounded });

      // Droops as it dries out.
      const droop = Math.max(0, (50 - water) / 50);
      foliage.setAttribute("transform", `translate(0 ${(droop * 12).toFixed(1)}) scale(${(1 + droop * 0.12).toFixed(3)} ${(1 - droop * 0.18).toFixed(3)})`);
      const thirsty = water < THIRSTY;
      if (thirsty !== shownThirsty) {
        shownThirsty = thirsty;
        for (const m of mouths) m.el.setAttribute("d", thirsty ? m.frown : m.smile);
      }

      if (pouring > 0) {
        pouring -= dt;
        can.setAttribute("display", pouring > 0 ? "inline" : "none");
        can.setAttribute("transform", `translate(-44 -230) rotate(${(30 * Math.min(1, (1.2 - pouring) * 4)).toFixed(1)})`);
        if (Math.floor(pouring * 20) !== Math.floor((pouring + dt) * 20)) ctx.fx("drop", def.x - 4 + (ctx.rng() - 0.5) * 10, def.y - 255);
      }
    },
    handle(g) {
      if (g.type !== "tap") return;
      water = 100;
      ctx.world.set(def.id, { water: 100 });
      pouring = 1.2;
      emitProp(ctx, def.id, "watered");
    },
    opportunities: () => [{ propId: def.id, action: "visit", weight: 0.8 }],
    spot: (action) => (action === "visit" ? { x: def.x, y: Math.max(ctx.area.minY + 10, def.y + 50) } : null),
    focus: () => ({ x: def.x, y: def.y - 150 }),
    catchDrop: (p) => (inBox(p, def.x - 70, def.y - 280, def.x + 70, def.y) ? "visit" : null),
  };
  return prop;
};
