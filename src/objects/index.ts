// All prop types, by the `type` name used in scene files.

import { createBall } from "./ball";
import { createBowl } from "./bowl";
import { createCouch } from "./couch";
import { createLamp } from "./lamp";
import type { PropFactory } from "./prop";
import { createWindow } from "./window";

export const propTypes: Record<string, PropFactory> = {
  ball: createBall,
  bowl: createBowl,
  couch: createCouch,
  lamp: createLamp,
  window: createWindow,
};
