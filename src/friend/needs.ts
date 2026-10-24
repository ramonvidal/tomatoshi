// Needs and mood. Each need is 0..100, where 100 is fully satisfied and 0
// is desperate. They drift down over time and go up when the need is met.
// Pure functions, so the numbers are easy to test and tune.

export type NeedName = "energy" | "fun" | "fullness" | "affection";
export type Needs = Record<NeedName, number>;

export const NEED_NAMES: readonly NeedName[] = ["energy", "fun", "fullness", "affection"];

export const DEFAULT_NEEDS: Needs = { energy: 80, fun: 60, fullness: 70, affection: 50 };

/** Change per minute while awake. */
const AWAKE_RATE: Needs = { energy: -1.5, fun: -4, fullness: -2.5, affection: -2 };
/** Change per minute while asleep: recharging, and hunger slows down. */
const ASLEEP_RATE: Needs = { energy: 8, fun: -0.5, fullness: -1, affection: -0.5 };
/** Sitting on the couch rests a little. */
const SITTING_ENERGY = 2;

export type NeedsActivity = "awake" | "sitting" | "asleep";

const clamp = (v: number) => Math.min(100, Math.max(0, v));

export function decayNeeds(needs: Needs, seconds: number, activity: NeedsActivity = "awake"): Needs {
  const rate = activity === "asleep" ? ASLEEP_RATE : AWAKE_RATE;
  const minutes = seconds / 60;
  const next = { ...needs };
  for (const name of NEED_NAMES) next[name] = clamp(needs[name] + rate[name] * minutes);
  if (activity === "sitting") next.energy = clamp(needs.energy + SITTING_ENERGY * minutes);
  return next;
}

export function applyEffect(needs: Needs, effect: Partial<Needs>): Needs {
  const next = { ...needs };
  for (const name of NEED_NAMES) next[name] = clamp(needs[name] + (effect[name] ?? 0));
  return next;
}

/** How much a need wants attention: 0.2 when satisfied, up to 6.2 when desperate. */
export function urgency(value: number): number {
  const lack = 1 - clamp(value) / 100;
  return 0.2 + 6 * lack * lack;
}

export type Mood = "content" | "grumpy" | "veryGrumpy" | "sleepy" | "hungry" | "lonely";

/** The most pressing problem wins; with none, it's grumpy (or secretly content). */
export function moodOf(n: Needs): Mood {
  if (n.energy < 20) return "sleepy";
  if (n.fullness < 25) return "hungry";
  if (n.affection < 20) return "lonely";
  const lowest = Math.min(n.energy, n.fun, n.fullness, n.affection);
  const average = (n.energy + n.fun + n.fullness + n.affection) / 4;
  if (lowest < 35) return "veryGrumpy";
  if (average > 72) return "content";
  return "grumpy";
}

/** Change per minute while you're away: it rests, and slowly misses things. */
const AWAY_RATE: Needs = { energy: 3, fun: -0.3, fullness: -0.3, affection: -0.1 };
/** The most a need can drop while you're away, so a long absence isn't a punishment. */
const AWAY_MAX_DROP: Needs = { energy: 0, fun: 40, fullness: 50, affection: 30 };

export function catchUp(needs: Needs, secondsAway: number): Needs {
  const minutes = Math.max(0, secondsAway) / 60;
  const next = { ...needs };
  for (const name of NEED_NAMES) {
    const change = Math.max(AWAY_RATE[name] * minutes, -AWAY_MAX_DROP[name]);
    next[name] = clamp(needs[name] + change);
  }
  return next;
}
