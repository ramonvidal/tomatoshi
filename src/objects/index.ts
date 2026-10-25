// All prop types, by the `type` name used in scene files.

import { createBall } from "./ball";
import { createBowl } from "./bowl";
import { createCompost } from "./compost";
import { createCouch } from "./couch";
import { createCritter } from "./critter";
import { createDoor } from "./door";
import { createFridge } from "./fridge";
import { createHammock } from "./hammock";
import { createKnives } from "./knives";
import { createLamp } from "./lamp";
import { createPendant } from "./pendant";
import { createPlant } from "./plant";
import type { PropFactory } from "./prop";
import { createRadio } from "./radio";
import { createSalad } from "./salad";
import { createSink } from "./sink";
import { createSky } from "./sky";
import { createSprinkler } from "./sprinkler";
import { createStove } from "./stove";
import { createTv } from "./tv";
import { createVeggies } from "./veggies";
import { createWindow } from "./window";

export const propTypes: Record<string, PropFactory> = {
  ball: createBall,
  bowl: createBowl,
  compost: createCompost,
  couch: createCouch,
  critter: createCritter,
  door: createDoor,
  fridge: createFridge,
  hammock: createHammock,
  knives: createKnives,
  lamp: createLamp,
  pendant: createPendant,
  plant: createPlant,
  radio: createRadio,
  salad: createSalad,
  sink: createSink,
  sky: createSky,
  sprinkler: createSprinkler,
  stove: createStove,
  tv: createTv,
  veggies: createVeggies,
  window: createWindow,
};
