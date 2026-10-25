// Hammock between two posts: Tomatoshi naps in it (day or night). Tap it to
// give it a swing, with or without a tomato in it.

import { Spring } from "../engine/spring";
import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { DARK, emitProp, inBox, tagProp, type Prop, type PropFactory } from "./prop";

const HALF = 110; // posts are this far either side of the center
const TOP = -150; // where the sling hangs from
const LOW = -84; // the sling's lowest point

export const createHammock: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { ...def.state });

  const sling = svgEl("g", {}, [
    svgEl("path", { d: `M ${-HALF} ${TOP} Q 0 ${LOW + 40} ${HALF} ${TOP} L ${HALF} ${TOP + 10} Q 0 ${LOW + 60} ${-HALF} ${TOP + 10} Z`, fill: c.hammock }),
    svgEl("path", { d: `M ${-HALF + 20} ${TOP + 12} Q 0 ${LOW + 52} ${HALF - 20} ${TOP + 12}`, stroke: c.hammockDark, "stroke-width": 4, fill: "none" }),
  ]);
  const post = (x: number) => svgEl("rect", { x: x - 7, y: TOP - 30, width: 14, height: -TOP + 30, rx: 5, fill: c.wood });
  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    svgEl("ellipse", { cx: 0, cy: 0, rx: 130, ry: 12, fill: c.shadow }),
    post(-HALF),
    post(HALF),
    sling,
  ]);
  tagProp(root, def.id, def.type);

  const swing = new Spring(10, 0.6);
  let time = 0;
  let angle = 0;

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y,
    update(dt) {
      time += dt;
      // A lazy sway, plus whatever push it was given.
      angle = Math.sin(time * 1.2) * 2 + swing.update(dt);
      sling.setAttribute("transform", `rotate(${angle.toFixed(2)} 0 ${TOP})`);
    },
    handle(g) {
      if (g.type !== "tap") return;
      swing.kick(30);
      emitProp(ctx, def.id, "swung");
    },
    opportunities: (light) => [
      { propId: def.id, action: "nap", weight: light < DARK ? 30 : 0.6 },
      { propId: def.id, action: "sit", weight: light < DARK ? 0 : 0.8 },
    ],
    spot: (action) => (action === "sit" || action === "nap" ? { x: def.x, y: def.y + 15 } : null),
    seatHeight: () => def.y + 15 - (def.y + LOW + 4),
    seatMotion: () => ({ dx: Math.sin((angle * Math.PI) / 180) * (LOW - TOP) * -1, rot: angle }),
    catchDrop: (p) => (inBox(p, def.x - HALF, def.y - 240, def.x + HALF, def.y - 30) ? "sit" : null),
    focus: () => ({ x: def.x, y: def.y + LOW }),
  };
  return prop;
};
