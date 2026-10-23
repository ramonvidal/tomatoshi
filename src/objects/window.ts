// Window: shows the real sky (day, dusk, night) and lets daylight in.
// Tap it to open or close the curtains.

import { skyAt } from "../engine/clock";
import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Prop, type PropFactory } from "./prop";

const W = 260;
const H = 300;
const INSET = 16;
const CURTAIN_OPEN = 34;
const CURTAIN_CLOSED = W / 2 + 22;

export const createWindow: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { curtainsOpen: true, ...def.state });
  const open = () => ctx.world.value<boolean>(def.id, "curtainsOpen");

  const paneW = W - INSET * 2;
  const paneH = H - INSET * 2;
  const sky = svgEl("rect", { x: INSET, y: INSET, width: paneW, height: paneH, rx: 8, fill: c.sky });

  const stars = svgEl(
    "g",
    { opacity: 0 },
    [
      [40, 50], [110, 30], [180, 70], [70, 120], [150, 150], [200, 210], [50, 230], [120, 250],
    ].map(([x, y], i) => svgEl("circle", { cx: INSET + x, cy: INSET + y, r: i % 3 === 0 ? 3.5 : 2.5, fill: c.star })),
  );

  const bodyX = INSET + paneW * 0.72;
  const bodyY = INSET + 70;
  const sun = svgEl("circle", { cx: bodyX, cy: bodyY, r: 30, fill: c.sun });
  // Crescent moon: a pale disc with a sky-colored disc over part of it.
  const moonBite = svgEl("circle", { cx: bodyX + 14, cy: bodyY - 8, r: 22, fill: c.sky });
  const moon = svgEl("g", {}, [svgEl("circle", { cx: bodyX, cy: bodyY, r: 26, fill: c.moon }), moonBite]);

  const frame = [
    svgEl("rect", { x: INSET + paneW / 2 - 6, y: INSET, width: 12, height: paneH, fill: c.windowFrame }),
    svgEl("rect", { x: INSET, y: INSET + paneH * 0.43, width: paneW, height: 12, fill: c.windowFrame }),
  ];

  const curtain = (side: -1 | 1) => {
    const g = svgEl("g");
    const panel = svgEl("rect", { y: -6, height: H + 26, rx: 10, fill: c.curtain });
    const fold = svgEl("rect", { y: -6, height: H + 26, width: 8, fill: c.curtainDark, opacity: 0.6 });
    g.append(panel, fold);
    return { g, panel, fold, side };
  };
  const left = curtain(-1);
  const right = curtain(1);
  const rod = svgEl("rect", { x: -30, y: -18, width: W + 60, height: 10, rx: 5, fill: c.lampMetal });

  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    svgEl("rect", { width: W, height: H, rx: 16, fill: c.windowFrame }),
    sky,
    stars,
    sun,
    moon,
    ...frame,
    left.g,
    right.g,
    rod,
  ]);
  tagProp(root, def.id, def.type);

  let openness = open() ? 1 : 0;
  let lastSky = "";

  const layoutCurtains = () => {
    const w = CURTAIN_CLOSED + (CURTAIN_OPEN - CURTAIN_CLOSED) * openness;
    // Left curtain hangs from the left edge, right from the right edge.
    left.panel.setAttribute("x", String(-22));
    left.panel.setAttribute("width", w.toFixed(1));
    left.fold.setAttribute("x", (-22 + w * 0.5).toFixed(1));
    right.panel.setAttribute("x", (W + 22 - w).toFixed(1));
    right.panel.setAttribute("width", w.toFixed(1));
    right.fold.setAttribute("x", (W + 22 - w * 0.5).toFixed(1));
  };
  layoutCurtains();

  const prop: Prop = {
    id: def.id,
    layer: "wall",
    root,
    sortY: () => def.y + H,
    update(dt) {
      const target = open() ? 1 : 0;
      if (openness !== target) {
        openness += Math.sign(target - openness) * Math.min(Math.abs(target - openness), dt * 3);
        layoutCurtains();
      }

      const s = skyAt(ctx.hour());
      const key = `${s.color}|${s.stars.toFixed(2)}|${s.body}`;
      if (key !== lastSky) {
        lastSky = key;
        sky.setAttribute("fill", s.color);
        moonBite.setAttribute("fill", s.color);
        stars.setAttribute("opacity", s.stars.toFixed(2));
        sun.setAttribute("display", s.body === "sun" ? "inline" : "none");
        moon.setAttribute("display", s.body === "moon" ? "inline" : "none");
      }
    },
    handle(g) {
      if (g.type !== "tap") return;
      ctx.world.set(def.id, { curtainsOpen: !open() });
      emitProp(ctx, def.id, "toggled");
    },
    ambientLight: () => skyAt(ctx.hour()).daylight * (0.12 + 0.88 * openness),
  };
  return prop;
};
