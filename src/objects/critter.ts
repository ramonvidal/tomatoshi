// A butterfly (a firefly at night). It flutters around the garden, sometimes
// lands on Tomatoshi's stem, and flies off when chased or tapped.

import { skyAt } from "../engine/clock";
import { between } from "../engine/random";
import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Point, type Prop, type PropFactory } from "./prop";

type Phase = "fly" | "landing" | "landed" | "flee";

export const createCritter: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { ...def.state });

  // Position: x, a depth on the floor (ground), and a height above it.
  let x = def.x;
  let ground = def.y;
  let height = 250;
  let target = { x, ground, height };
  let phase: Phase = "fly";
  let phaseTime = 0;
  let nextLanding = between(ctx.rng, 6, 12);
  let time = 0;

  const wing = (side: -1 | 1) =>
    svgEl("ellipse", { cx: side * 11, cy: 0, rx: 12, ry: 15, fill: c.butterfly, transform: `rotate(${side * 20})` });
  const wings = svgEl("g", {}, [wing(-1), wing(1)]);
  const butterfly = svgEl("g", {}, [wings, svgEl("rect", { x: -2.5, y: -10, width: 5, height: 22, rx: 2.5, fill: c.ink })]);
  const glow = svgEl("circle", { r: 14, fill: c.firefly });
  const firefly = svgEl("g", {}, [glow, svgEl("circle", { r: 5, fill: c.fireflyCore })]);
  const root = svgEl("g", {}, [svgEl("circle", { r: 40, fill: "transparent" }), butterfly, firefly]);
  tagProp(root, def.id, def.type);

  const isNight = () => skyAt(ctx.hour()).daylight < 0.3;
  const screen = (): Point => ({ x, y: ground - height });
  const friendHere = () => ctx.friend().room.id === ctx.roomId;

  const pickTarget = () => {
    target = {
      x: between(ctx.rng, ctx.area.minX - 60, ctx.area.maxX + 60),
      ground: between(ctx.rng, ctx.area.minY, ctx.area.maxY),
      height: between(ctx.rng, 120, 420),
    };
  };

  const flee = () => {
    phase = "flee";
    phaseTime = 0;
    target = { x: x + between(ctx.rng, -250, 250), ground, height: 600 };
    nextLanding = between(ctx.rng, 10, 20);
  };

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    // Always drawn in front: it's in the air (or on top of a tomato).
    sortY: () => 5000,
    update(dt) {
      time += dt;
      phaseTime += dt;
      const f = ctx.friend();

      if (phase === "landed") {
        // Riding on its stem.
        if (!friendHere() || phaseTime > 9) flee();
        else {
          const top = f.headTop;
          x = top.x;
          ground = f.ground;
          height = ground - top.y + 4;
        }
      } else {
        if (phase === "landing") {
          if (!friendHere() || !f.idle) {
            phase = "fly";
          } else {
            const top = f.headTop;
            target = { x: top.x, ground: f.ground, height: f.ground - top.y + 4 };
          }
        }
        const speed = phase === "flee" ? 260 : phase === "landing" ? 150 : 90;
        const dx = target.x - x;
        const dg = target.ground - ground;
        const dh = target.height - height;
        const dist = Math.hypot(dx, dg, dh);
        const step = Math.min(dist, speed * dt);
        if (dist > 0.01) {
          x += (dx / dist) * step;
          ground += (dg / dist) * step;
          height += (dh / dist) * step;
        }
        if (dist < 6) {
          if (phase === "landing") {
            phase = "landed";
            phaseTime = 0;
            emitProp(ctx, def.id, "landed");
          } else {
            if (phase === "flee") phase = "fly";
            pickTarget();
          }
        }
        nextLanding -= dt;
        if (phase === "fly" && nextLanding <= 0) {
          nextLanding = between(ctx.rng, 8, 16);
          if (friendHere() && f.idle && f.solid) {
            phase = "landing";
            phaseTime = 0;
          }
        }
      }

      // Flutter: wings flap, and it bobs a little while flying.
      const night = isNight();
      butterfly.setAttribute("display", night ? "none" : "inline");
      firefly.setAttribute("display", night ? "inline" : "none");
      const flap = phase === "landed" ? 0.6 + Math.abs(Math.sin(time * 3)) * 0.4 : Math.abs(Math.sin(time * 18));
      wings.setAttribute("transform", `scale(${Math.max(0.15, flap).toFixed(2)} 1)`);
      glow.setAttribute("opacity", (0.35 + Math.abs(Math.sin(time * 2.2)) * 0.6).toFixed(2));
      const bob = phase === "landed" ? 0 : Math.sin(time * 5) * 6;
      const p = screen();
      root.setAttribute("transform", `translate(${p.x.toFixed(1)} ${(p.y + bob).toFixed(1)})`);
    },
    handle(g) {
      if (g.type !== "tap") return;
      flee();
      emitProp(ctx, def.id, "shooed");
    },
    opportunities: () => [{ propId: def.id, action: "chase", weight: phase === "fly" ? 0.7 : 0 }],
    spot: (action) =>
      action === "chase" && phase === "fly"
        ? { x: Math.min(ctx.area.maxX, Math.max(ctx.area.minX, x)), y: Math.min(ctx.area.maxY, Math.max(ctx.area.minY, ground)) }
        : null,
    // Chased (or shaken off): away it goes.
    use(action) {
      if (action === "chase") flee();
    },
    focus: screen,
    // Fireflies give off a little light.
    lightSource: () => (isNight() ? { ...screen(), radius: 110, tone: "warm" } : null),
  };
  return prop;
};
