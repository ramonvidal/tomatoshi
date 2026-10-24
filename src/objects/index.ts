// All prop types, by the `type` name used in scene files.

import { createBall } from "./ball";
import { createBowl } from "./bowl";
import { createCouch } from "./couch";
import { createDoor } from "./door";
import { createFridge } from "./fridge";
import { createKnives } from "./knives";
import { createLamp } from "./lamp";
import { createPendant } from "./pendant";
import { createPlant } from "./plant";
import type { PropFactory } from "./prop";
import { createRadio } from "./radio";
import { createSalad } from "./salad";
import { createSink } from "./sink";
import { createStove } from "./stove";
import { createTv } from "./tv";
import { createVeggies } from "./veggies";
import { createWindow } from "./window";

export const propTypes: Record<string, PropFactory> = {
  ball: createBall,
  bowl: createBowl,
  couch: createCouch,
  door: createDoor,
  fridge: createFridge,
  knives: createKnives,
  lamp: createLamp,
  pendant: createPendant,
  plant: createPlant,
  radio: createRadio,
  salad: createSalad,
  sink: createSink,
  stove: createStove,
  tv: createTv,
  veggies: createVeggies,
  window: createWindow,
};
