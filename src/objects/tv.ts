// TV: tap to switch channels (off → color bars → static → cooking show → off).
// Tomatoshi watches, grumbles at static, and wants nothing to do with
// cooking shows.

import { between } from "../engine/random";
import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Prop, type PropFactory } from "./prop";

export const CHANNELS = 4;
/** Channel numbers: what's on. */
export const CHANNEL = { off: 0, bars: 1, static: 2, cooking: 3 } as const;

export const nextChannel = (channel: number) => (channel + 1) % CHANNELS;

const SCREEN = { x: -50, y: -122, w: 84, h: 72 };

export const createTv: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { channel: CHANNEL.off, ...def.state });
  const channel = () => ctx.world.value<number>(def.id, "channel");

  const clipId = `tv-screen-${def.id}`;
  const screenRect = { x: SCREEN.x, y: SCREEN.y, width: SCREEN.w, height: SCREEN.h, rx: 12 };

  const barColors = [c.sun, c.ball, c.curtain, c.couch, c.snack, c.blush];
  const bars = svgEl(
    "g",
    {},
    [...barColors, ...barColors].map((fill, i) => svgEl("rect", { x: SCREEN.x + i * 16, y: SCREEN.y, width: 16, height: SCREEN.h, fill })),
  );
  const noise = svgEl(
    "g",
    {},
    Array.from({ length: 14 }, () => svgEl("rect", { width: 12, height: 5, fill: c.white })),
  );
  // The cooking show: a chef's knife. Tomatoshi does not approve.
  const knife = svgEl("g", {}, [
    svgEl("path", { d: "M -36 -82 L 14 -96 Q 22 -96 18 -88 L -36 -78 Z", fill: "#e8edf2" }),
    svgEl("rect", { x: -48, y: -86, width: 16, height: 10, rx: 3, fill: c.lampMetal, transform: "rotate(-15 -40 -81)" }),
  ]);
  const shows = svgEl("g", { "clip-path": `url(#${clipId})` }, [bars, noise, knife]);

  const root = svgEl("g", { transform: `translate(${def.x} ${def.y})` }, [
    svgEl("defs", {}, [svgEl("clipPath", { id: clipId }, [svgEl("rect", screenRect)])]),
    svgEl("ellipse", { cx: 0, cy: -2, rx: 62, ry: 9, fill: c.shadow }),
    svgEl("path", { d: "M -14 -138 L -40 -176 M 14 -138 L 38 -172", stroke: c.lampMetal, "stroke-width": 3, "stroke-linecap": "round" }),
    svgEl("rect", { x: -44, y: -14, width: 10, height: 14, rx: 3, fill: c.tvDark }),
    svgEl("rect", { x: 34, y: -14, width: 10, height: 14, rx: 3, fill: c.tvDark }),
    svgEl("rect", { x: -62, y: -140, width: 124, height: 128, rx: 18, fill: c.tv }),
    svgEl("rect", { ...screenRect, fill: c.tvScreen }),
    shows,
    svgEl("circle", { cx: 48, cy: -108, r: 6, fill: c.tvDark }),
    svgEl("circle", { cx: 48, cy: -88, r: 6, fill: c.tvDark }),
    svgEl("rect", { x: 42, y: -70, width: 12, height: 4, rx: 2, fill: c.tvDark }),
    svgEl("rect", { x: 42, y: -62, width: 12, height: 4, rx: 2, fill: c.tvDark }),
  ]);
  tagProp(root, def.id, def.type);

  let time = 0;
  let noiseTimer = 0;
  let shown = -1;

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    sortY: () => def.y,
    update(dt) {
      time += dt;
      const ch = channel();
      if (ch !== shown) {
        shown = ch;
        bars.setAttribute("display", ch === CHANNEL.bars ? "inline" : "none");
        noise.setAttribute("display", ch === CHANNEL.static ? "inline" : "none");
        knife.setAttribute("display", ch === CHANNEL.cooking ? "inline" : "none");
      }
      if (ch === CHANNEL.bars) {
        bars.setAttribute("transform", `translate(${(-((time * 30) % 96)).toFixed(1)} 0)`);
      } else if (ch === CHANNEL.static) {
        noiseTimer -= dt;
        if (noiseTimer <= 0) {
          noiseTimer = 0.07;
          for (const r of noise.children) {
            r.setAttribute("x", between(ctx.rng, SCREEN.x, SCREEN.x + SCREEN.w).toFixed(0));
            r.setAttribute("y", between(ctx.rng, SCREEN.y, SCREEN.y + SCREEN.h).toFixed(0));
          }
        }
      } else if (ch === CHANNEL.cooking) {
        knife.setAttribute("transform", `translate(0 ${(Math.sin(time * 6) * 3).toFixed(1)}) rotate(${(Math.sin(time * 3) * 8).toFixed(1)} -10 -86)`);
      }
    },
    handle(g) {
      if (g.type !== "tap") return;
      ctx.world.set(def.id, { channel: nextChannel(channel()) });
      emitProp(ctx, def.id, "channel");
    },
    opportunities: () => [
      { propId: def.id, action: "watch", weight: channel() === CHANNEL.bars || channel() === CHANNEL.static ? 1.5 : 0 },
    ],
    spot: (action) =>
      action === "watch" && channel() !== CHANNEL.off
        ? { x: def.x + 150, y: Math.min(ctx.area.maxY, def.y - 40) }
        : null,
    focus: () => ({ x: def.x - 8, y: def.y - 86 }),
    ambientLight: () => (channel() !== CHANNEL.off ? 0.12 : 0),
    lightSource: () => (channel() !== CHANNEL.off ? { x: def.x - 8, y: def.y - 86, radius: 300, tone: "cool" } : null),
  };
  return prop;
};
