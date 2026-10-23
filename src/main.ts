import "./style.css";
import { EventBus, type GameEvents } from "./engine/events";
import { Loop } from "./engine/loop";
import { createStage } from "./engine/stage";
import { drawTomatoshi } from "./friend/art";
import { drawLivingRoom } from "./scenes/living-room";

const app = document.getElementById("app");
if (!app) throw new Error("#app element missing");

const events = new EventBus<GameEvents>();
const stage = createStage(app);

stage.layers.background.appendChild(drawLivingRoom());

const tomatoshi = drawTomatoshi();
tomatoshi.root.setAttribute("transform", "translate(360 1080)");
stage.layers.friend.appendChild(tomatoshi.root);

// Placeholder idle "breathing" so the loop is visibly running. Replaced by
// the real animation system in M1.
events.on("loop.tick", ({ time }) => {
  const squash = 1 + Math.sin(time * 2.4) * 0.02;
  tomatoshi.body.setAttribute("transform", `scale(${2 - squash} ${squash})`);
});

new Loop((dt, time) => events.emit("loop.tick", { dt, time })).start();
