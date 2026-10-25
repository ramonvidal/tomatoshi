// How Tomatoshi reacts when it sees you do something with an object in its
// room. A pure decision (what it would do) that Tomatoshi then acts out, so
// the whole table is easy to read and test.

import type { ObjectState } from "../engine/world";
import type { PropEventKind, UseAction } from "../objects/prop";
import type { BubbleSymbol } from "./bubbles";
import type { ExpressionName } from "./expressions";
import type { Mood, Needs } from "./needs";

export interface WitnessContext {
  /** The object's type, as in the scene file ("lamp", "radio"…). */
  type: string;
  kind: PropEventKind;
  /** The object's state after the change. */
  state: Readonly<ObjectState> | null;
  needs: Needs;
  mood: Mood;
  asleep: boolean;
  /** What it's doing with this very object right now, if anything. */
  usingThis: UseAction | null;
  /** Sitting on it (couch, sink, hammock). */
  perchedHere: boolean;
}

export interface Witness {
  say?: BubbleSymbol;
  express?: ExpressionName;
  /** How long the expression holds (seconds). */
  seconds?: number;
  /** Wakes it up, grumpily. */
  wake?: boolean;
  sweat?: boolean;
  shiver?: boolean;
  hearts?: number;
  /** Goes over to do this with the object. */
  go?: UseAction;
  /** Small direct effects on its needs. */
  affection?: number;
  fun?: number;
}

/** Things loud enough to wake it from a nap. */
const NOISY = new Set(["radio:toggled", "tv:channel", "door:door", "knives:rattled", "sprinkler:toggled", "compost:opened"]);

export function witness(c: WitnessContext): Witness | null {
  const key = `${c.type}:${c.kind}`;
  const on = c.state?.on === true;

  if (c.asleep) {
    // Only noise wakes it. Turning on a light it sleeps through (unless the
    // room gets bright enough, which the light check handles).
    if (key === "radio:toggled" && !on) return null;
    return NOISY.has(key) ? { wake: true } : null;
  }

  switch (key) {
    case "lamp:toggled":
    case "pendant:toggled":
      // Lights on: squints. Lights off (and not dark enough to sleep): huh?
      return on ? { express: "sleepy", seconds: 0.7, say: "ellipsis" } : { say: "question" };

    case "window:toggled":
      return c.state?.curtainsOpen ? { say: "ellipsis" } : { say: "question" };

    case "radio:toggled":
      if (!on) return c.usingThis === "dance" ? { say: "anger", express: "annoyed", seconds: 1 } : { say: "question" };
      // Music! Stem perks up, foot taps. It would deny all of it.
      return c.needs.fun < 60
        ? { say: "note", express: "content", seconds: 1.2, fun: 3 }
        : { say: "ellipsis", express: "content", seconds: 0.8 };

    case "tv:channel": {
      const channel = c.state?.channel;
      if (channel === 0) return c.usingThis === "watch" ? { say: "anger", express: "annoyed", seconds: 1 } : null;
      if (channel === 2) return { say: "anger" }; // static
      if (channel === 1) return c.needs.fun < 50 ? { say: "exclaim", go: "watch" } : { say: "ellipsis" };
      return null; // the cooking show has its own (much bigger) reaction
    }

    case "stove:toggled":
      return on
        ? { say: "exclaim", express: "surprised", seconds: 0.8, sweat: true }
        : { say: "ellipsis", express: "content", seconds: 0.6 }; // phew

    case "fridge:toggled":
      if (c.state?.open) {
        if (c.needs.fullness < 60) return { say: "exclaim", go: "eat" };
        return { shiver: true, say: "ellipsis" }; // close it, it's cold
      }
      return c.usingThis === "eat" ? { say: "anger", express: "annoyed", seconds: 1 } : null;

    case "sink:splashed":
      if (c.perchedHere) return null; // handled as a splash in the bath
      return c.needs.fun < 45 ? { say: "question", go: "bathe" } : null;

    case "plant:watered":
      // Someone looked after its cousins. It's… grateful. Quietly.
      return { say: "ellipsis", express: "secretlyHappy", seconds: 1.2, hearts: 1, affection: 4 };

    case "bowl:bumped":
      return { say: "question" };

    case "salad:tossed":
      return { say: "anger", express: "angry", seconds: 0.9 };

    case "veggies:onion":
      return { say: "ellipsis" };

    case "couch:bounced":
      return c.perchedHere ? null : { say: "question" };

    case "hammock:swung":
      // Being swung: flustered, like being stroked.
      return c.perchedHere ? { say: "ellipsis", express: "flustered", seconds: 1.4, affection: 2 } : { say: "question" };

    case "sprinkler:toggled":
      if (!on) return c.usingThis === "play" ? { say: "anger", express: "annoyed", seconds: 1 } : null;
      return c.needs.fun < 55 ? { say: "exclaim", go: "play" } : { say: "ellipsis" };

    case "compost:opened":
      // Where vegetables go when it's over. Horrifying.
      return { say: "exclaim", express: "surprised", seconds: 1, sweat: true };

    case "critter:shooed":
      return { say: "ellipsis" };
  }
  return null;
}

/** Seconds and counts for "stop fiddling with that". */
export const SPAM_WINDOW = 3.5;
export const SPAM_ANNOYED = 4;
export const SPAM_FURIOUS = 7;

export type SpamLevel = "none" | "annoyed" | "furious";

/** How fed up it is with the same object being fiddled with. */
export function spamLevel(times: number[], now: number): SpamLevel {
  const recent = times.filter((t) => now - t < SPAM_WINDOW).length;
  if (recent >= SPAM_FURIOUS) return "furious";
  if (recent >= SPAM_ANNOYED) return "annoyed";
  return "none";
}
