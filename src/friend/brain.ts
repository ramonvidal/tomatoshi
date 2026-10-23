// What Tomatoshi does when nobody is bothering it. Pure functions over an
// injectable random source, so behavior is reproducible in tests.
// M3 replaces the fixed weights with needs-driven utility scoring.

import { between, weighted, type Rng } from "../engine/random";

export interface Area {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export type Activity =
  | { kind: "idle"; duration: number }
  | { kind: "lookAround"; duration: number }
  | { kind: "walk"; x: number; y: number }
  | { kind: "mutter"; symbol: "ellipsis" | "anger" | "question"; duration: number }
  | { kind: "glareAtYou"; duration: number }
  | { kind: "sulk"; duration: number };

export type ActivityKind = Activity["kind"];

export interface BrainContext {
  x: number;
  y: number;
  area: Area;
  /** Seconds since the user last touched it. */
  idleFor: number;
  last: ActivityKind | null;
  rng: Rng;
}

/** Ignored this long (seconds), it starts sulking. */
export const SULK_AFTER = 40;
/** Walks shorter than this aren't worth getting up for. */
export const MIN_WALK = 120;

export function chooseActivity(ctx: BrainContext): Activity {
  const { rng } = ctx;
  const ignored = ctx.idleFor >= SULK_AFTER;

  const kind = weighted<ActivityKind>(rng, {
    idle: 3,
    lookAround: 2,
    walk: ctx.last === "walk" ? 1.5 : 4,
    mutter: 1,
    glareAtYou: 1,
    sulk: ignored && ctx.last !== "sulk" ? 6 : 0,
  });

  switch (kind) {
    case "idle":
      return { kind, duration: between(rng, 1.5, 4) };
    case "lookAround":
      return { kind, duration: between(rng, 2, 4) };
    case "walk":
      return { kind, ...walkTarget(ctx) };
    case "mutter":
      return {
        kind,
        symbol: weighted(rng, { ellipsis: 3, anger: 1, question: 1 }),
        duration: between(rng, 1.4, 2.2),
      };
    case "glareAtYou":
      return { kind, duration: between(rng, 1.5, 2.5) };
    case "sulk":
      return { kind, duration: between(rng, 4, 7) };
  }
}

/** A random spot in the area, far enough to be worth walking to. */
export function walkTarget({ x, y, area, rng }: Pick<BrainContext, "x" | "y" | "area" | "rng">): {
  x: number;
  y: number;
} {
  let best = { x: area.minX, y: area.minY };
  let bestDist = -1;
  for (let i = 0; i < 8; i++) {
    const p = { x: between(rng, area.minX, area.maxX), y: between(rng, area.minY, area.maxY) };
    const d = Math.hypot(p.x - x, p.y - y);
    if (d >= MIN_WALK) return p;
    if (d > bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

/** Somewhere on the far side of the area from `fromX`: storming off. */
export function awayFrom(fromX: number, { y, area, rng }: Pick<BrainContext, "y" | "area" | "rng">) {
  const mid = (area.minX + area.maxX) / 2;
  const x = fromX < mid ? between(rng, mid + 80, area.maxX) : between(rng, area.minX, mid - 80);
  const ty = Math.min(area.maxY, Math.max(area.minY, y + between(rng, -100, 100)));
  return { x, y: ty };
}

export const clampToArea = (area: Area, x: number, y: number) => ({
  x: Math.min(area.maxX, Math.max(area.minX, x)),
  y: Math.min(area.maxY, Math.max(area.minY, y)),
});
