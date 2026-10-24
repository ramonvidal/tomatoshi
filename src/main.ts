import "./style.css";
import { attachDebugPanel } from "./debug";
import { clampToArea } from "./engine/area";
import { createClock } from "./engine/clock";
import { EventBus, type GameEvents } from "./engine/events";
import { attachPointerInput, GestureRecognizer } from "./engine/input";
import { Loop } from "./engine/loop";
import { Particles } from "./engine/particles";
import { seededRng } from "./engine/random";
import { Room } from "./engine/room";
import { createStage } from "./engine/stage";
import { clearSave, loadSave, safeStorage, writeSave } from "./engine/storage";
import { World } from "./engine/world";
import { catchUp } from "./friend/needs";
import { Tomatoshi } from "./friend/Tomatoshi";
import { propTypes } from "./objects";
import { backdrops, scenes } from "./scenes";

const app = document.getElementById("app");
if (!app) throw new Error("#app element missing");

// Options come from the query string (?debug) or, where only a hash can be
// passed (e.g. a shared link), from a single hash word (#debug).
const params = new URLSearchParams(location.search);
const hashWord = location.hash.slice(1);
const option = (name: string) => params.has(name) || hashWord === name;
const storage = safeStorage();
if (option("reset")) clearSave(storage);
const saved = loadSave(storage);
const secondsAway = saved ? Math.max(0, (Date.now() - saved.savedAt) / 1000) : 0;

const events = new EventBus<GameEvents>();
const world = new World(events, saved?.world);
const stage = createStage(app);
const rng = seededRng(Date.now());
const scene = scenes["living-room"];
const particles = new Particles(stage.layers.effects, rng);

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
    hour: createClock(hashWord === "night" ? "?hour=22" : location.search),
    fx: particles.emit,
    friend: () => {
      if (!tomatoshi) throw new Error("Tomatoshi not created yet");
      return tomatoshi;
    },
  },
  propTypes,
  backdrops,
);

const start = saved ? clampToArea(scene.walkArea, saved.friend.x, saved.friend.y) : scene.start;
const friend = new Tomatoshi({
  area: scene.walkArea,
  room,
  x: start.x,
  y: start.y,
  // Time away is caught up gently: it rested, and got a bit hungry and bored.
  needs: saved ? catchUp(saved.friend.needs, secondsAway) : undefined,
  fx: particles.emit,
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
  particles.update(dt);
});

// Remember everything between visits.
const save = () =>
  writeSave(storage, { version: 1, savedAt: Date.now(), friend: friend.save(), world: world.snapshot() });
setInterval(save, 5000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") save();
});
addEventListener("pagehide", save);

if (option("debug")) attachDebugPanel(friend, () => room.light());

friend.greet(secondsAway, saved?.friend.needs.affection);
document.body.classList.add("ready"); // fade in

// Installable and playable offline (production builds only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // Not fatal: it just won't work offline.
  });
}
new Loop((dt, time) => events.emit("loop.tick", { dt, time })).start();
