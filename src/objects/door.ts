// Door to another room. Tap it to go through (the view follows; Tomatoshi
// stays where it is). Tomatoshi uses doors on its own, and sometimes peeks
// back in after leaving. A locked door (puzzle hook) just rattles.

import { Spring } from "../engine/spring";
import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Prop, type PropFactory } from "./prop";

const W = 112;
const H = 256;
/** How long the door stays open when someone goes through. */
const OPEN_TIME = 1.4;

/** A small sign above the door hints at what's on the other side. */
function sign(to: string): SVGElement[] {
  if (to === "kitchen") {
    // A cooking pot.
    return [
      svgEl("rect", { x: -13, y: -6, width: 26, height: 14, rx: 4, fill: c.lampMetal }),
      svgEl("rect", { x: -17, y: -9, width: 34, height: 4, rx: 2, fill: c.lampMetal }),
      svgEl("path", { d: "M -6 -14 q 2 -4 0 -7 M 4 -14 q 2 -4 0 -7", stroke: c.lampMetal, "stroke-width": 2.5, fill: "none", "stroke-linecap": "round" }),
    ];
  }
  // A little couch.
  return [
    svgEl("rect", { x: -14, y: -10, width: 28, height: 10, rx: 4, fill: c.couchDark }),
    svgEl("rect", { x: -18, y: -4, width: 36, height: 10, rx: 4, fill: c.couch }),
  ];
}

export const createDoor: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { to: "", locked: false, ...def.state });
  const to = () => ctx.world.value<string>(def.id, "to");
  const locked = () => ctx.world.value<boolean>(def.id, "locked");

  // What's seen through the open door: darkness, and sometimes a peeking tomato.
  const peeker = svgEl("g", { display: "none" }, [
    svgEl("circle", { cx: W / 2 - 4, cy: -140, r: 46, fill: c.tomato }),
    svgEl("ellipse", { cx: W / 2 - 22, cy: -146, rx: 6, ry: 8, fill: c.ink }),
    svgEl("ellipse", { cx: W / 2 + 4, cy: -146, rx: 6, ry: 8, fill: c.ink }),
    svgEl("rect", { x: W / 2 - 30, y: -158, width: 44, height: 9, fill: c.tomato }),
    svgEl("path", { d: `M ${W / 2 - 32} -162 L ${W / 2 - 12} -156 M ${W / 2 + 12} -162 L ${W / 2 - 4} -156`, stroke: c.ink, "stroke-width": 4, "stroke-linecap": "round" }),
  ]);
  const doorway = svgEl("g", {}, [
    svgEl("rect", { x: -W / 2, y: -H, width: W, height: H, fill: c.doorway }),
    peeker,
  ]);
  doorway.setAttribute("clip-path", `url(#door-clip-${def.id})`);

  const panel = svgEl("g", {}, [
    svgEl("rect", { x: -W / 2, y: -H, width: W, height: H, rx: 4, fill: c.door }),
    svgEl("rect", { x: -W / 2 + 14, y: -H + 16, width: W - 28, height: 96, rx: 6, fill: c.doorPanel }),
    svgEl("rect", { x: -W / 2 + 14, y: -H + 128, width: W - 28, height: 108, rx: 6, fill: c.doorPanel }),
    svgEl("circle", { cx: W / 2 - 16, cy: -H / 2 + 6, r: 7, fill: c.lampShade }),
  ]);

  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    svgEl("defs", {}, [svgEl("clipPath", { id: `door-clip-${def.id}` }, [svgEl("rect", { x: -W / 2, y: -H, width: W, height: H })])]),
    svgEl("rect", { x: -W / 2 - 12, y: -H - 12, width: W + 24, height: H + 12, rx: 6, fill: c.windowFrame }),
    doorway,
    panel,
    svgEl("g", { transform: `translate(0 ${-H - 40})` }, [svgEl("circle", { r: 22, fill: c.windowFrame }), ...sign(to())]),
  ]);
  tagProp(root, def.id, def.type);

  let openFor = 0;
  let peekFor = 0;
  let openness = 0;
  const rattle = new Spring(400, 10);

  const open = (seconds: number) => {
    openFor = Math.max(openFor, seconds);
  };

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y,
    update(dt) {
      openFor = Math.max(0, openFor - dt);
      peekFor = Math.max(0, peekFor - dt);
      // Fully open for someone going through; just a crack for a peek.
      const target = openFor > 0 ? 1 : peekFor > 0 ? 0.45 : 0;
      openness += (target - openness) * (1 - Math.exp(-10 * dt));
      // The panel swings on its left hinge: seen from the front it gets narrower.
      const sx = 1 - openness * 0.85;
      panel.setAttribute(
        "transform",
        `translate(${(rattle.update(dt) * 2).toFixed(2)} 0) translate(${-W / 2} 0) scale(${sx.toFixed(3)} 1) translate(${W / 2} 0)`,
      );
      peeker.setAttribute("display", peekFor > 0 && openness > 0.3 ? "inline" : "none");
    },
    handle(g) {
      if (g.type !== "tap") return;
      if (locked()) {
        rattle.kick(30);
        emitProp(ctx, def.id, "rattled");
        return;
      }
      open(OPEN_TIME);
      emitProp(ctx, def.id, "door");
    },
    opportunities: () => (locked() || !to() ? [] : [{ propId: def.id, action: "leave", weight: 0.25 }]),
    // In front of the door, but never outside where Tomatoshi can walk (so it
    // doesn't arrive half off screen).
    spot: (action) =>
      action === "leave" && !locked()
        ? { x: Math.min(ctx.area.maxX, Math.max(ctx.area.minX, def.x)), y: ctx.area.minY }
        : null,
    use(action) {
      if (action === "leave") open(OPEN_TIME);
    },
    focus: () => ({ x: def.x, y: def.y - H / 2 }),
    doorTo: () => to() || null,
    peek() {
      peekFor = 2.4;
    },
  };
  return prop;
};
