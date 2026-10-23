import { describe, expect, it } from "vitest";
import { EventBus, type GameEvents } from "../src/engine/events";
import { World } from "../src/engine/world";

function setup() {
  const events = new EventBus<GameEvents>();
  const changes: GameEvents["world.changed"][] = [];
  events.on("world.changed", (c) => changes.push(c));
  return { world: new World(events), changes };
}

describe("World", () => {
  it("emits one event per key that actually changed", () => {
    const { world, changes } = setup();
    world.add("lamp", { on: false, color: "warm" });

    world.set("lamp", { on: true, color: "warm" });

    expect(changes).toEqual([{ id: "lamp", key: "on", value: true, previous: false }]);
    expect(world.value("lamp", "on")).toBe(true);
  });

  it("does not emit when registering initial state", () => {
    const { world, changes } = setup();
    world.add("bowl", { food: 2 });
    expect(changes).toEqual([]);
  });

  it("returns snapshots that later changes don't affect", () => {
    const { world } = setup();
    world.add("bowl", { food: 2 });
    const before = world.snapshot();
    world.set("bowl", { food: 0 });
    expect(before).toEqual({ bowl: { food: 2 } });
  });

  it("rejects unknown objects", () => {
    const { world } = setup();
    expect(() => world.set("ghost", { boo: true })).toThrow(/Unknown/);
  });
});
