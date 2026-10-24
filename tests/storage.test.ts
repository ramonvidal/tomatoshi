import { describe, expect, it } from "vitest";
import { EventBus, type GameEvents } from "../src/engine/events";
import { loadSave, parseSave, writeSave, type SaveData } from "../src/engine/storage";
import { World } from "../src/engine/world";
import { DEFAULT_NEEDS } from "../src/friend/needs";

const valid: SaveData = {
  version: 1,
  savedAt: 1_700_000_000_000,
  friend: { needs: { energy: 10, fun: 20, fullness: 30, affection: 40 }, x: 300, y: 1000 },
  world: { lamp: { on: true }, bowl: { food: 1 } },
};

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

describe("storage", () => {
  it("round-trips a save", () => {
    const storage = memoryStorage();
    writeSave(storage, valid);
    expect(loadSave(storage)).toEqual(valid);
  });

  it("remembers which room it was in, and ignores a non-text room", () => {
    const withRoom = { ...valid, friend: { ...valid.friend, room: "kitchen" } };
    expect(parseSave(JSON.stringify(withRoom))?.friend.room).toBe("kitchen");
    const badRoom = { ...valid, friend: { ...valid.friend, room: 42 } };
    expect(parseSave(JSON.stringify(badRoom))?.friend).not.toHaveProperty("room");
  });

  it("rejects garbage, wrong versions and missing fields", () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave("not json")).toBeNull();
    expect(parseSave(JSON.stringify({ ...valid, version: 2 }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...valid, friend: { needs: valid.friend.needs } }))).toBeNull();
  });

  it("repairs bad need values instead of trusting them", () => {
    const raw = JSON.stringify({ ...valid, friend: { ...valid.friend, needs: { energy: 500, fun: "lots" } } });
    const save = parseSave(raw);
    expect(save?.friend.needs).toEqual({ ...DEFAULT_NEEDS, energy: 100 });
  });

  it("drops non-primitive world values", () => {
    const raw = JSON.stringify({ ...valid, world: { lamp: { on: true, evil: { nested: 1 } }, junk: 5 } });
    expect(parseSave(raw)?.world).toEqual({ lamp: { on: true } });
  });

  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    } as unknown as Storage;
    expect(loadSave(broken)).toBeNull();
    expect(() => writeSave(broken, valid)).not.toThrow();
  });

  it("restores saved world state over defaults, ignoring stale or mistyped keys", () => {
    const world = new World(new EventBus<GameEvents>(), { lamp: { on: true, color: "red" }, bowl: { food: "many" } });
    world.add("lamp", { on: false });
    world.add("bowl", { food: 3 });
    expect(world.get("lamp")).toEqual({ on: true });
    expect(world.get("bowl")).toEqual({ food: 3 });
  });
});
