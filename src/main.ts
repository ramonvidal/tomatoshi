import "./style.css";
import { EventBus, type GameEvents } from "./engine/events";
import { attachPointerInput, GestureRecognizer } from "./engine/input";
import { Loop } from "./engine/loop";
import { seededRng } from "./engine/random";
import { createStage } from "./engine/stage";
import { Tomatoshi } from "./friend/Tomatoshi";
import { drawLivingRoom, WALK_AREA } from "./scenes/living-room";

const app = document.getElementById("app");
if (!app) throw new Error("#app element missing");

const events = new EventBus<GameEvents>();
const stage = createStage(app);

stage.layers.background.appendChild(drawLivingRoom());

const tomatoshi = new Tomatoshi({
  area: WALK_AREA,
  x: 360,
  y: 1080,
  rng: seededRng(Date.now()),
  onReaction: (reaction) => events.emit("friend.reaction", { reaction }),
});
stage.layers.friend.append(tomatoshi.parts.shadow, tomatoshi.parts.root);
stage.layers.ui.appendChild(tomatoshi.bubble.root);

const recognizer = new GestureRecognizer((gesture) => events.emit("input.gesture", gesture));
attachPointerInput(stage, {
  recognizer,
  boundsOf: (target) => (target === "none" ? null : tomatoshi.bounds),
  onPoint: (x, y) => tomatoshi.point(x, y),
});
events.on("input.gesture", (gesture) => tomatoshi.handle(gesture));

events.on("loop.tick", ({ dt }) => {
  recognizer.update(performance.now());
  tomatoshi.update(dt);
});

new Loop((dt, time) => events.emit("loop.tick", { dt, time })).start();
