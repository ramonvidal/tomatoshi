// All rooms and their backdrops.

import type { SceneDef } from "../engine/room";
import { drawGarden, garden } from "./garden";
import { drawKitchen, kitchen } from "./kitchen";
import { drawLivingRoom, livingRoom } from "./living-room";

export const backdrops: Record<string, () => SVGGElement> = {
  "living-room": drawLivingRoom,
  kitchen: drawKitchen,
  garden: drawGarden,
};

export const scenes: Record<string, SceneDef> = {
  "living-room": livingRoom,
  kitchen,
  garden,
};

/** Where a new game starts. */
export const FIRST_ROOM = "living-room";
