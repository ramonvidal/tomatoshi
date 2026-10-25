// Couch: Tomatoshi sits and naps on it. Tap it to bounce the cushions
// (and whoever is sitting on them).

import { Spring } from "../engine/spring";
import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { DARK, emitProp, inBox, tagProp, type Prop, type PropFactory } from "./prop";

/** Distance in front of the couch where Tomatoshi stands before hopping up. */
const FRONT = 65;
/** Seat height above the floor in front of the couch. */
const SEAT = 170;

export const createCouch: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { ...def.state });

  const seat = svgEl("g", {}, [
    svgEl("rect", { x: -130, y: -140, width: 260, height: 90, rx: 24, fill: c.couch }),
    svgEl("rect", { x: -4, y: -136, width: 8, height: 60, rx: 4, fill: c.couchDark, opacity: 0.5 }),
  ]);
  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    svgEl("rect", { x: -150, y: -240, width: 300, height: 150, rx: 40, fill: c.couchDark }),
    seat,
    svgEl("rect", { x: -170, y: -160, width: 60, height: 140, rx: 28, fill: c.couch }),
    svgEl("rect", { x: 110, y: -160, width: 60, height: 140, rx: 28, fill: c.couch }),
    svgEl("rect", { x: -130, y: -24, width: 20, height: 24, rx: 6, fill: c.couchDark }),
    svgEl("rect", { x: 110, y: -24, width: 20, height: 24, rx: 6, fill: c.couchDark }),
  ]);
  tagProp(root, def.id, def.type);

  const squash = new Spring(260, 9);

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y,
    update(dt) {
      // Squash the cushions down toward their base (y = -50).
      const sy = 1 - squash.update(dt);
      seat.setAttribute("transform", `translate(0 -50) scale(1 ${sy.toFixed(3)}) translate(0 50)`);
    },
    handle(g) {
      if (g.type !== "tap") return;
      squash.kick(3);
      emitProp(ctx, def.id, "bounced");
    },
    opportunities: (light) => [
      // Very sleepy in the dark; otherwise an occasional sit or daytime nap.
      { propId: def.id, action: "nap", weight: light < DARK ? 30 : 0.3 },
      { propId: def.id, action: "sit", weight: light < DARK ? 0 : 1 },
    ],
    spot(action, from) {
      if (action !== "sit" && action !== "nap") return null;
      return { x: Math.min(def.x + 60, Math.max(def.x - 60, from.x)), y: def.y + FRONT };
    },
    seatHeight: () => SEAT,
    catchDrop: (p) => (inBox(p, def.x - 150, def.y - 280, def.x + 150, def.y - 30) ? "sit" : null),
  };
  return prop;
};
