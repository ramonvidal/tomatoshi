// Saving between visits, in localStorage. Everything read back is
// validated: a corrupt or outdated save falls back to a fresh start.

import type { FriendSave } from "../friend/Tomatoshi";
import { DEFAULT_NEEDS, NEED_NAMES, type Needs } from "../friend/needs";
import type { ObjectState, WorldState } from "./world";

export const SAVE_KEY = "tomatoshi.save.v1";

export interface SaveData {
  version: 1;
  /** ms since epoch */
  savedAt: number;
  friend: FriendSave;
  world: WorldState;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseNeeds(v: unknown): Needs {
  const needs = { ...DEFAULT_NEEDS };
  if (!isRecord(v)) return needs;
  for (const name of NEED_NAMES) {
    const n = v[name];
    if (isFiniteNumber(n)) needs[name] = Math.min(100, Math.max(0, n));
  }
  return needs;
}

function parseWorld(v: unknown): WorldState {
  const world: WorldState = {};
  if (!isRecord(v)) return world;
  for (const [id, state] of Object.entries(v)) {
    if (!isRecord(state)) continue;
    const clean: ObjectState = {};
    for (const [key, value] of Object.entries(state)) {
      if (value === null || ["string", "boolean"].includes(typeof value) || isFiniteNumber(value)) {
        clean[key] = value as ObjectState[string];
      }
    }
    world[id] = clean;
  }
  return world;
}

export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.version !== 1 || !isFiniteNumber(data.savedAt) || !isRecord(data.friend)) return null;
  const { x, y, room } = data.friend;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
  return {
    version: 1,
    savedAt: data.savedAt,
    friend: { needs: parseNeeds(data.friend.needs), x, y, ...(typeof room === "string" ? { room } : {}) },
    world: parseWorld(data.world),
  };
}

/** localStorage, or null where it's unavailable (private mode, blocked). */
export function safeStorage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

export function loadSave(storage: Storage | null): SaveData | null {
  try {
    return parseSave(storage?.getItem(SAVE_KEY) ?? null);
  } catch {
    return null;
  }
}

export function writeSave(storage: Storage | null, data: SaveData): void {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: keep playing without saving.
  }
}

export function clearSave(storage: Storage | null): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
