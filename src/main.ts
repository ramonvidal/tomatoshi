import "./style.css";
import { createClock } from "./engine/clock";
import { EventBus, type GameEvents } from "./engine/events";
import { attachPointerInput, GestureRecognizer } from "./engine/input";
import { Loop } from "./engine/loop";
import { seededRng } from "./engine/random";
import { Room } from "./engine/room";
import { createStage } from "./engine/stage";
import { World } from "./engine/world";
import { Tomatoshi } from "./friend/Tomatoshi";
import { propTypes } from "./objects";
import { backdrops, scenes } from "./scenes";

const app = document.getElementById("app");
if (!app) throw new Error("#app element missing");

const events = new EventBus<GameEvents>();
const world = new World(events);
const stage = createStage(app);
const rng = seededRng(Date.now());
const scene = scenes["living-room"];

// The room and Tomatoshi need each other: props bump into it, it uses props.
let tomatoshi: Tomatoshi | null = null;
const room = new Room(
  scene,
  stage,
  {
    world,
    events,
    rng,
    area: scene.walkArea,
    hour: createClock(),
    friend: () => {
      if (!tomatoshi) throw new Error("Tomatoshi not created yet");
      return tomatoshi;
    },
  },
  propTypes,
  backdrops,
);

const friend = new Tomatoshi({
  area: scene.walkArea,
  room,
  x: scene.start.x,
  y: scene.start.y,
  rng,
  onReaction: (reaction) => events.emit("friend.reaction", { reaction }),
});
tomatoshi = friend;
stage.layers.shadows.appendChild(friend.parts.shadow);
stage.layers.world.appendChild(friend.parts.root);
stage.layers.ui.appendChild(friend.bubble.root);

const recognizer = new GestureRecognizer((gesture) => events.emit("input.gesture", gesture));
attachPointerInput(stage, {
  recognizer,
  boundsOf: (target) => (target === "body" || target === "stem" ? friend.bounds : room.boundsOf(target)),
  onPoint: (x, y) => friend.point(x, y),
});

events.on("input.gesture", (gesture) => {
  if (room.handle(gesture)) friend.userActive();
  else friend.handle(gesture);
});
events.on("prop.event", ({ id, kind }) => friend.notice(id, kind));

events.on("loop.tick", ({ dt }) => {
  recognizer.update(performance.now());
  friend.update(dt);
  room.update(dt, { root: friend.parts.root, y: friend.ground });
});

new Loop((dt, time) => events.emit("loop.tick", { dt, time })).start();
