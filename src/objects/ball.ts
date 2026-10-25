// Ball: tap to nudge it, drag and fling to throw it. Tomatoshi chases it and
// kicks it back at you, and is not amused when it gets hit by it.

import { depthScale, type Area } from "../engine/area";
import { between } from "../engine/random";
import { svgEl } from "../engine/stage";
import { palette as c } from "../palette";
import { emitProp, tagProp, type Point, type Prop, type PropFactory } from "./prop";

const R = 34;
const GRAVITY = 2600;
/** Ground-plane friction while rolling (per second, exponential). */
const ROLL_FRICTION = 1.3;
const BOUNCE = 0.55;
const REST_SPEED = 25;
/** Only a real throw bonks Tomatoshi; a nudge just rolls up to it. */
const BONK_SPEED = 420;

export interface BallBody {
  x: number;
  /** Ground y (depth). */
  y: number;
  /** Height above the ground. */
  h: number;
  vx: number;
  vy: number;
  vh: number;
}

/** Advance the ball: gravity, bounces, rolling friction, walls. Pure. */
export function stepBall(b: BallBody, area: Area, dt: number): BallBody {
  let { x, y, h, vx, vy, vh } = b;
  if (h > 0 || vh > 0) {
    vh -= GRAVITY * dt;
    h += vh * dt;
    if (h <= 0) {
      h = 0;
      vh = -vh * BOUNCE;
      if (vh < 120) vh = 0;
    }
  }
  x += vx * dt;
  y += vy * dt;
  if (h <= 0) {
    const f = Math.exp(-ROLL_FRICTION * dt);
    vx *= f;
    vy *= f;
    if (Math.hypot(vx, vy) < REST_SPEED) {
      vx = 0;
      vy = 0;
    }
  }
  if (x < area.minX || x > area.maxX) {
    x = Math.min(area.maxX, Math.max(area.minX, x));
    vx = -vx * 0.7;
  }
  if (y < area.minY || y > area.maxY) {
    y = Math.min(area.maxY, Math.max(area.minY, y));
    vy = -vy * 0.7;
  }
  return { x, y, h, vx, vy, vh };
}

export const createBall: PropFactory = (def, ctx) => {
  ctx.world.add(def.id, { resting: true, ...def.state });

  // The ball may roll a bit further than Tomatoshi walks.
  const area: Area = {
    minX: ctx.area.minX - 50,
    maxX: ctx.area.maxX + 50,
    minY: ctx.area.minY - 10,
    maxY: ctx.area.maxY + 30,
  };
  let body: BallBody = { x: def.x, y: def.y, h: 0, vx: 0, vy: 0, vh: 0 };
  let spin = 0;
  let held: { dx: number; dy: number } | null = null;
  let bonkCooldown = 0;

  const stripes = svgEl("g", {}, [
    svgEl("ellipse", { cx: 0, cy: 0, rx: R, ry: 9, fill: c.ballStripe }),
    svgEl("ellipse", { cx: 0, cy: 0, rx: 9, ry: R, fill: c.ballStripe, opacity: 0.85 }),
  ]);
  const ball = svgEl("g", {}, [
    // Larger invisible touch area: the ball is small on a phone.
    svgEl("circle", { cx: 0, cy: 0, r: R * 1.6, fill: "transparent" }),
    svgEl("circle", { cx: 0, cy: 0, r: R, fill: c.ball }),
    stripes,
    svgEl("ellipse", { cx: -12, cy: -14, rx: 9, ry: 6, fill: "white", opacity: 0.45, transform: "rotate(-35 -12 -14)" }),
  ]);
  const root = svgEl("g", {}, [ball]);
  tagProp(root, def.id, def.type);
  const shadow = svgEl("ellipse", { rx: R * 0.9, ry: 8, fill: c.shadow });

  const scale = () => depthScale(ctx.area, body.y);
  const speed = () => Math.hypot(body.vx, body.vy, body.vh);
  const center = (): Point => ({ x: body.x, y: body.y - body.h - R * scale() });

  const launch = (vx: number, vy: number, vh: number) => {
    body = { ...body, vx, vy, vh };
    ctx.world.set(def.id, { resting: false });
  };

  /** Bonk Tomatoshi if the ball flies into it, or falls on its head. */
  const checkFriend = () => {
    const f = ctx.friend();
    if (f.room.id !== ctx.roomId) return; // it's in another room
    if (f.solid && bonkCooldown <= 0 && body.vh < -200) {
      // Falling onto its head (as it looks on screen): boing.
      const top = f.headTop;
      const ballY = body.y - body.h;
      if (body.h > 0 && Math.abs(body.x - f.x) < 70 * f.depthScale && ballY > top.y && ballY < top.y + 80) {
        body = { ...body, vh: Math.abs(body.vh) * 0.7, vx: body.vx + (body.x >= f.x ? 160 : -160) };
        bonkCooldown = 0.6;
        emitProp(ctx, def.id, "hit-friend");
        return;
      }
    }
    if (!f.solid || bonkCooldown > 0 || Math.hypot(body.vx, body.vy) < BONK_SPEED) return;
    const dx = body.x - f.x;
    const dy = body.y - f.ground;
    const reach = R * scale() + 85 * f.depthScale;
    const approaching = dx * body.vx + dy * body.vy < 0;
    if (Math.abs(dx) < reach && Math.abs(dy) < 45 && body.h < 180 * f.depthScale && approaching) {
      body = { ...body, vx: -body.vx * 0.45, vy: -body.vy * 0.45, vh: Math.max(body.vh, 250) };
      bonkCooldown = 0.6;
      emitProp(ctx, def.id, "hit-friend");
    }
  };

  const prop: Prop = {
    id: def.id,
    layer: "world",
    root,
    shadow,
    sortY: () => body.y,
    update(dt) {
      bonkCooldown = Math.max(0, bonkCooldown - dt);
      if (!held) {
        const before = speed();
        body = stepBall(body, area, dt);
        spin += (body.vx * dt * 180) / (Math.PI * R);
        checkFriend();
        if (before > 0 && speed() === 0 && body.h === 0) ctx.world.set(def.id, { resting: true });
      }

      const s = scale();
      root.setAttribute("transform", `translate(${body.x.toFixed(1)} ${(body.y - body.h - R * s).toFixed(1)}) scale(${s.toFixed(3)})`);
      stripes.setAttribute("transform", `rotate(${spin.toFixed(1)})`);
      const shadowScale = s / (1 + body.h / 300);
      shadow.setAttribute("transform", `translate(${body.x.toFixed(1)} ${body.y.toFixed(1)}) scale(${shadowScale.toFixed(3)})`);
    },
    handle(g) {
      switch (g.type) {
        case "tap": {
          // Nudge it away from the finger.
          const dir = Math.sign(body.x - g.x) || 1;
          launch(dir * between(ctx.rng, 250, 380), between(ctx.rng, -80, 80), 300);
          emitProp(ctx, def.id, "thrown");
          break;
        }
        case "dragStart": {
          const p = center();
          held = { dx: g.startX - p.x, dy: g.startY - p.y };
          ctx.world.set(def.id, { resting: false });
          break;
        }
        case "dragMove": {
          if (!held) break;
          const s = scale();
          const cy = g.y - held.dy;
          const groundY = Math.min(area.maxY, Math.max(area.minY, cy + R * s));
          body = {
            ...body,
            x: Math.min(area.maxX, Math.max(area.minX, g.x - held.dx)),
            y: groundY,
            h: Math.max(0, groundY - cy - R * s),
            vx: 0,
            vy: 0,
            vh: 0,
          };
          break;
        }
        case "dragEnd": {
          if (!held) break;
          held = null;
          // Flicking up the screen throws it up and further back.
          const vx = Math.max(-1800, Math.min(1800, g.vx));
          const vy = Math.max(-900, Math.min(900, g.vy * 0.45));
          const vh = Math.max(0, Math.min(1300, -g.vy * 0.6));
          launch(vx, vy, vh);
          if (Math.hypot(g.vx, g.vy) > 300) emitProp(ctx, def.id, "thrown");
          break;
        }
      }
    },
    bounds: () => {
      const p = center();
      const r = R * scale() * 1.3;
      return { cx: p.x, cy: p.y, rx: r, ry: r };
    },
    opportunities: () =>
      held || speed() > 0 ? [] : [{ propId: def.id, action: "kick", weight: 0.8 }],
    spot(action, from) {
      if (action !== "kick" || held) return null;
      // Stand beside it, on the side Tomatoshi is coming from.
      const side = Math.sign(from.x - body.x) || 1;
      const x = body.x + side * (R + 80) * scale();
      return {
        x: Math.min(ctx.area.maxX, Math.max(ctx.area.minX, x)),
        y: Math.min(ctx.area.maxY, Math.max(ctx.area.minY, body.y)),
      };
    },
    use(action, from) {
      if (action !== "kick" || held) return;
      // Kick it away, and mostly back toward the viewer.
      const away = Math.sign(body.x - from.x) || 1;
      const dx = away * between(ctx.rng, 0.3, 0.9);
      const dy = between(ctx.rng, 0.5, 1);
      const len = Math.hypot(dx, dy);
      const power = between(ctx.rng, 650, 950);
      launch((dx / len) * power, (dy / len) * power, between(ctx.rng, 350, 650));
      bonkCooldown = 0.4;
      emitProp(ctx, def.id, "kicked");
    },
    focus: center,
  };
  return prop;
};
