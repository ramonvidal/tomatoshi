// All prop types, by the `type` name used in scene files.

import { createBall } from "./ball";
import { createBowl } from "./bowl";
import { createCouch } from "./couch";
import { createLamp } from "./lamp";
import { createPlant } from "./plant";
import type { PropFactory } from "./prop";
import { createRadio } from "./radio";
import { createTv } from "./tv";
import { createWindow } from "./window";

export const propTypes: Record<string, PropFactory> = {
  ball: createBall,
  bowl: createBowl,
  couch: createCouch,
  lamp: createLamp,
  plant: createPlant,
  radio: createRadio,
  tv: createTv,
  window: createWindow,
};
