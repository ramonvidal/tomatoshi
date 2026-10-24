// Radio on a wall shelf: tap to play or stop music. Tomatoshi dances to
// it, but only when it thinks nobody is watching.

import { Spring } from "../engine/spring";
import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Prop, type PropFactory } from "./prop";

const SPEAKER = { x: -66, y: -33 };

export const createRadio: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { on: false, ...def.state });
  const isOn = () => ctx.world.value<boolean>(def.id, "on");

  const speaker = svgEl("g", {}, [
    svgEl("circle", { cx: SPEAKER.x, cy: SPEAKER.y, r: 21, fill: c.radioDark }),
    ...[-8, 0, 8].map((dy) => svgEl("rect", { x: SPEAKER.x - 14, y: SPEAKER.y + dy - 1.5, width: 28, height: 3, rx: 1.5, fill: c.radio })),
  ]);
  const light = svgEl("circle", { cx: -4, cy: -18, r: 4, fill: c.radioDark });
  const radio = svgEl("g", {}, [
    svgEl("path", { d: "M -8 -64 L 26 -112", stroke: c.lampMetal, "stroke-width": 3, "stroke-linecap": "round" }),
    svgEl("circle", { cx: 26, cy: -112, r: 4, fill: c.lampMetal }),
    svgEl("rect", { x: -100, y: -66, width: 112, height: 66, rx: 14, fill: c.radio }),
    speaker,
    svgEl("rect", { x: -32, y: -50, width: 34, height: 18, rx: 4, fill: c.radioDial }),
    svgEl("rect", { x: -18, y: -48, width: 3, height: 14, fill: c.curtainDark }),
    light,
  ]);
  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    // Shelf with two brackets, and a few books for company.
    svgEl("rect", { x: -120, y: 0, width: 240, height: 12, rx: 4, fill: c.shelf }),
    svgEl("path", { d: "M -90 12 L -90 34 L -70 12 Z", fill: c.shelfDark }),
    svgEl("path", { d: "M 90 12 L 90 34 L 70 12 Z", fill: c.shelfDark }),
    svgEl("rect", { x: 40, y: -58, width: 16, height: 58, rx: 2, fill: c.curtain }),
    svgEl("rect", { x: 58, y: -50, width: 14, height: 50, rx: 2, fill: c.couch }),
    svgEl("rect", { x: 74, y: -62, width: 18, height: 62, rx: 2, fill: c.lampShade, transform: "rotate(8 92 0)" }),
    radio,
  ]);
  tagProp(root, def.id, def.type);

  const thump = new Spring(300, 12);
  let beat = 0;
  let lastNote = 0;
  let time = 0;

  const prop: Prop = {
    id: def.id,
    layer: "wall",
    root,
    sortY: () => def.y,
    update(dt) {
      time += dt;
      const on = isOn();
      if (on) {
        // A beat twice a second: the speaker thumps and notes drift out.
        const next = Math.floor(time * 2);
        if (next !== beat) {
          beat = next;
          thump.kick(5);
        }
        if (time - lastNote > 0.6) {
          lastNote = time;
          ctx.fx("note", def.x + SPEAKER.x, def.y + SPEAKER.y - 20);
        }
      }
      const s = 1 + Math.max(0, thump.update(dt)) * 0.05;
      speaker.setAttribute("transform", `translate(${SPEAKER.x} ${SPEAKER.y}) scale(${s.toFixed(3)}) translate(${-SPEAKER.x} ${-SPEAKER.y})`);
      light.setAttribute("fill", on ? c.radioLight : c.radioDark);
    },
    handle(g) {
      if (g.type !== "tap") return;
      ctx.world.set(def.id, { on: !isOn() });
      thump.kick(8);
      emitProp(ctx, def.id, "toggled");
    },
    // Music fills the room: it dances wherever it is.
    opportunities: () => [{ propId: def.id, action: "dance", weight: isOn() ? 3 : 0 }],
    spot: (action, from) => (action === "dance" && isOn() ? from : null),
  };
  return prop;
};
