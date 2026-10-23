// Central event bus. Every action in the world goes through here so that
// future systems (puzzles, triggers, sounds) can listen without coupling.

import type { Gesture } from "./input";
import type { Value } from "./world";
import type { Reaction } from "../friend/Tomatoshi";
import type { PropEventKind } from "../objects/prop";

export type Listener<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener as Listener<never>);
    return () => this.off(type, listener);
  }

  off<K extends keyof Events>(type: K, listener: Listener<Events[K]>): void {
    this.listeners.get(type)?.delete(listener as Listener<never>);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    // Copy so listeners can unsubscribe while being called.
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      (listener as Listener<Events[K]>)(payload);
    }
  }
}

/** Events known to the game. Grows as features are added. */
export type GameEvents = {
  "loop.tick": { dt: number; time: number };
  "input.gesture": Gesture;
  "friend.reaction": { reaction: Reaction };
  "world.changed": { id: string; key: string; value: Value; previous: Value };
  "prop.event": { id: string; kind: PropEventKind };
};
