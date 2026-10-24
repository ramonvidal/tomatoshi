// What Tomatoshi does when nobody is bothering it: utility scoring, where
// what objects offer is weighed by how much it needs it right now. Pure
// functions over an injectable random source, so behavior is reproducible.

import type { Area } from "../engine/area";
import { between, weighted, type Rng } from "../engine/random";
import type { Opportunity, UseAction } from "../objects/prop";
import { DEFAULT_NEEDS, moodOf, urgency, type NeedName, type Needs } from "./needs";

export type { Area };

export type Activity =
  | { kind: "idle"; duration: number }
  | { kind: "lookAround"; duration: number }
  | { kind: "walk"; x: number; y: number }
  | { kind: "mutter"; symbol: "ellipsis" | "anger" | "question" | "snack" | "zzz"; duration: number }
  | { kind: "glareAtYou"; duration: number }
  | { kind: "sulk"; duration: number }
  | { kind: "use"; propId: string; action: UseAction; duration: number };

export type ActivityKind = Activity["kind"];

export interface BrainContext {
  x: number;
  y: number;
  area: Area;
  /** Seconds since the user last touched it. */
  idleFor: number;
  last: ActivityKind | null;
  /** What the room's objects offer right now. */
  opportunities: Opportunity[];
  needs?: Needs;
  /** Places it won't pick to walk to. */
  avoid?: (p: { x: number; y: number }) => boolean;
  rng: Rng;
}

/** Which need each kind of object use satisfies. */
export const NEED_FOR: Record<UseAction, NeedName> = {
  eat: "fullness",
  inspect: "fullness",
  nap: "energy",
  sit: "energy",
  kick: "fun",
  watch: "fun",
  dance: "fun",
  // Visiting its cousin the plant is how it consoles itself.
  visit: "affection",
  leave: "fun",
  bathe: "fun",
  grumble: "fun",
};

/** What objects offer, weighted by how much it needs each thing now. */
export function weighOpportunities(opportunities: Opportunity[], needs: Needs): Opportunity[] {
  return opportunities.map((o) => ({ ...o, weight: o.weight * urgency(needs[NEED_FOR[o.action]]) }));
}

/** Ignored this long (seconds), it starts sulking. */
export const SULK_AFTER = 40;
/** Walks shorter than this aren't worth getting up for. */
export const MIN_WALK = 120;

export function chooseActivity(ctx: BrainContext): Activity {
  const { rng } = ctx;
  const needs = ctx.needs ?? DEFAULT_NEEDS;
  const mood = moodOf(needs);
  const ignored = ctx.idleFor >= SULK_AFTER;
  const lonely = mood === "lonely";
  const opportunities = weighOpportunities(ctx.opportunities, needs);

  const useWeight = opportunities.reduce((sum, o) => sum + Math.max(0, o.weight), 0);
  // A pressing need leaves less time for standing around.
  const pressing = mood === "hungry" || mood === "sleepy" || mood === "veryGrumpy" ? 0.5 : 1;
  const kind = weighted<ActivityKind>(rng, {
    idle: 3 * pressing,
    lookAround: 2 * pressing,
    walk: (ctx.last === "walk" ? 1.5 : 3) * pressing,
    mutter: mood === "hungry" || mood === "sleepy" ? 2.5 : 1,
    // Lonely: stares at you, wanting attention it would never ask for.
    glareAtYou: lonely ? 3 : 1,
    sulk: (ignored || lonely) && ctx.last !== "sulk" ? 6 : 0,
    // Objects are more interesting than standing around, but not every time.
    use: ctx.last === "use" ? useWeight * 0.4 : useWeight,
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
        symbol:
          mood === "hungry"
            ? weighted(rng, { snack: 4, anger: 1 })
            : mood === "sleepy"
              ? weighted(rng, { zzz: 3, ellipsis: 1 })
              : weighted(rng, { ellipsis: 3, anger: mood === "veryGrumpy" ? 3 : 1, question: 1 }),
        duration: between(rng, 1.4, 2.2),
      };
    case "glareAtYou":
      return { kind, duration: between(rng, 1.5, 2.5) };
    case "sulk":
      return { kind, duration: between(rng, 4, 7) };
    case "use": {
      const options = Object.fromEntries(opportunities.map((o, i) => [String(i), o.weight]));
      const o = opportunities[Number(weighted(rng, options))];
      return { kind, propId: o.propId, action: o.action, duration: useDuration(o.action, rng) };
    }
  }
}

/** How long it keeps at it once there (seconds). */
export function useDuration(action: UseAction, rng: Rng): number {
  switch (action) {
    case "sit":
      return between(rng, 6, 12);
    case "nap":
      return between(rng, 20, 40);
    case "kick":
      return 0.7;
    case "eat":
      return 2.6;
    case "inspect":
      return 2.6;
    case "watch":
      return between(rng, 8, 14);
    case "visit":
      return 3.4;
    case "dance":
      return between(rng, 6, 10);
    case "leave":
      return 0.7;
    case "bathe":
      return between(rng, 6, 9);
    case "grumble":
      return 3;
  }
}

/** A random spot in the area, far enough to be worth walking to. */
export function walkTarget({ x, y, area, rng, avoid }: Pick<BrainContext, "x" | "y" | "area" | "rng" | "avoid">): {
  x: number;
  y: number;
} {
  // Fallback: the middle of the front of the room, which is never dangerous.
  let best = { x: (area.minX + area.maxX) / 2, y: area.maxY };
  let bestDist = -1;
  for (let i = 0; i < 12; i++) {
    const p = { x: between(rng, area.minX, area.maxX), y: between(rng, area.minY, area.maxY) };
    if (avoid?.(p)) continue;
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
