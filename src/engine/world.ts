// The world's state: every object's state in one serializable place.
// Changes go through `set`, which emits one `world.changed` event per key,
// so future puzzle triggers can be written as "when lamp.on is false…".

import type { EventBus, GameEvents } from "./events";

export type Value = string | number | boolean | null;
export type ObjectState = Record<string, Value>;
export type WorldState = Record<string, ObjectState>;

export class World {
  private state: WorldState = {};

  /** `saved` is state from a previous visit; it overrides initial values. */
  constructor(
    private readonly events: EventBus<GameEvents>,
    private readonly saved: WorldState = {},
  ) {}

  /** Register an object with its initial state (no events). */
  add(id: string, initial: ObjectState): void {
    const state = { ...initial };
    // Only keys the object still has: stale keys in old saves are dropped.
    for (const [key, value] of Object.entries(this.saved[id] ?? {})) {
      if (key in state && typeof value === typeof state[key]) state[key] = value;
    }
    this.state[id] = state;
  }

  get(id: string): Readonly<ObjectState> {
    const s = this.state[id];
    if (!s) throw new Error(`Unknown world object: ${id}`);
    return s;
  }

  value<T extends Value>(id: string, key: string): T {
    return this.get(id)[key] as T;
  }

  set(id: string, patch: ObjectState): void {
    const s = this.state[id];
    if (!s) throw new Error(`Unknown world object: ${id}`);
    for (const [key, value] of Object.entries(patch)) {
      const previous = s[key] ?? null;
      if (previous === value) continue;
      s[key] = value;
      this.events.emit("world.changed", { id, key, value, previous });
    }
  }

  snapshot(): WorldState {
    return structuredClone(this.state);
  }
}
