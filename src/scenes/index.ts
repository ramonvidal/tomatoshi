// All rooms and their backdrops.

import type { SceneDef } from "../engine/room";
import { drawLivingRoom, livingRoom } from "./living-room";

export const backdrops: Record<string, () => SVGGElement> = {
  "living-room": drawLivingRoom,
};

export const scenes: Record<string, SceneDef> = {
  "living-room": livingRoom,
};
