// The open sky over the garden: its color follows the real time of day, the
// sun and moon travel across it, clouds drift, stars come out at night.
// Drawn behind the backdrop, so fences and the house stand in front of it.

import { skyAt } from "../engine/clock";
import { STAGE_WIDTH, svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { tagProp, type Prop, type PropFactory } from "./prop";

const BLEED = 1200;
/** Where the sky meets the ground (behind the fence). */
const HORIZON = 800;

/** Where the sun (or moon) is: x across the stage, height of its arc (0..1). */
export function sunPosition(hour: number): { x: number; arc: number } {
  // The sun is up 6:00–20:00, the moon 20:00–6:00; each crosses left to right.
  const h = ((hour % 24) + 24) % 24;
  const t = h >= 6 && h < 20 ? (h - 6) / 14 : ((h + 4) % 24) / 10;
  return { x: 40 + t * (STAGE_WIDTH - 80), arc: Math.sin(t * Math.PI) };
}

export const createSky: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { ...def.state });

  const sky = svgEl("rect", { x: -BLEED, y: -BLEED, width: STAGE_WIDTH + 2 * BLEED, height: HORIZON + BLEED, fill: c.sky });
  const stars = svgEl(
    "g",
    { opacity: 0 },
    Array.from({ length: 26 }, (_, i) =>
      svgEl("circle", {
        cx: ((i * 137) % (STAGE_WIDTH + 200)) - 100,
        cy: 30 + ((i * 89) % 520),
        r: i % 4 === 0 ? 3.5 : 2.2,
        fill: c.star,
      }),
    ),
  );
  const sun = svgEl("circle", { r: 42, fill: c.sun });
  const moonBite = svgEl("circle", { cx: 18, cy: -10, r: 32, fill: c.sky });
  const moon = svgEl("g", {}, [svgEl("circle", { r: 36, fill: c.moon }), moonBite]);
  const body = svgEl("g", {}, [sun, moon]);

  const cloud = (scale: number) =>
    svgEl("g", {}, [
      svgEl("ellipse", { cx: 0, cy: 0, rx: 60 * scale, ry: 22 * scale, fill: c.cloud }),
      svgEl("circle", { cx: -22 * scale, cy: -14 * scale, r: 26 * scale, fill: c.cloud }),
      svgEl("circle", { cx: 18 * scale, cy: -20 * scale, r: 32 * scale, fill: c.cloud }),
    ]);
  const clouds = [
    { el: cloud(1), x: 80, y: 150, speed: 9 },
    { el: cloud(0.7), x: 420, y: 90, speed: 6 },
    { el: cloud(1.2), x: 640, y: 260, speed: 11 },
  ];

  const root = svgEl("g", {}, [sky, stars, body, ...clouds.map((cl) => cl.el)]);
  tagProp(root, def.id, def.type);
  root.setAttribute("pointer-events", "none");

  let lastKey = "";

  const prop: Prop = {
    id: def.id,
    layer: "sky",
    root,
    sortY: () => 0,
    update(dt) {
      const hour = ctx.hour();
      const s = skyAt(hour);
      const key = `${s.color}|${s.stars.toFixed(2)}`;
      if (key !== lastKey) {
        lastKey = key;
        sky.setAttribute("fill", s.color);
        moonBite.setAttribute("fill", s.color);
        stars.setAttribute("opacity", s.stars.toFixed(2));
      }
      const pos = sunPosition(hour);
      const isDay = hour >= 6 && hour < 20;
      sun.setAttribute("display", isDay ? "inline" : "none");
      moon.setAttribute("display", isDay ? "none" : "inline");
      body.setAttribute("transform", `translate(${pos.x.toFixed(1)} ${(HORIZON - 120 - pos.arc * 560).toFixed(1)})`);

      // Clouds drift right and wrap around; dimmer at night.
      for (const cl of clouds) {
        cl.x += cl.speed * dt;
        if (cl.x > STAGE_WIDTH + 200) cl.x = -200;
        cl.el.setAttribute("transform", `translate(${cl.x.toFixed(1)} ${cl.y})`);
        cl.el.setAttribute("opacity", (0.35 + 0.65 * s.daylight).toFixed(2));
      }
    },
    // Outdoors: full daylight, and a little moonlight at night.
    ambientLight: () => 0.15 + 0.85 * skyAt(ctx.hour()).daylight,
  };
  return prop;
};
