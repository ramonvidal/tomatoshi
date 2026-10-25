import "./style.css";
import { attachDebugPanel } from "./debug";
import { clampToArea } from "./engine/area";
import { createClock } from "./engine/clock";
import { EventBus, type GameEvents } from "./engine/events";
import { House } from "./engine/house";
import { attachPointerInput, GestureRecognizer } from "./engine/input";
import { Loop } from "./engine/loop";
import { seededRng } from "./engine/random";
import { createStage } from "./engine/stage";
import { clearSave, loadSave, safeStorage, writeSave } from "./engine/storage";
import { World } from "./engine/world";
import { catchUp } from "./friend/needs";
import { Tomatoshi } from "./friend/Tomatoshi";
import { propTypes } from "./objects";
import { backdrops, FIRST_ROOM, scenes } from "./scenes";

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

// Start where Tomatoshi was, looking at its room.
const startRoom = saved?.friend.room && scenes[saved.friend.room] ? saved.friend.room : FIRST_ROOM;

// The house and Tomatoshi need each other: props bump into it, it uses props.
let tomatoshi: Tomatoshi | null = null;
const house = new House(
  stage,
  Object.values(scenes),
  {
    world,
    events,
    rng,
    hour: createClock(hashWord === "night" ? "?hour=22" : location.search),
    friend: () => {
      if (!tomatoshi) throw new Error("Tomatoshi not created yet");
      return tomatoshi;
    },
  },
  propTypes,
  backdrops,
  startRoom,
);

const room = house.room(startRoom);
const start = saved ? clampToArea(room.walkArea, saved.friend.x, saved.friend.y) : room.def.start;
const friend = new Tomatoshi({
  room,
  x: start.x,
  y: start.y,
  // Time away is caught up gently: it rested, and got a bit hungry and bored.
  needs: saved ? catchUp(saved.friend.needs, secondsAway) : undefined,
  // Its particles go to whichever room it's in.
  fx: (kind, x, y, count) => house.room(friend.room.id).fx(kind, x, y, count),
  travel: (doorId) => house.friendLeft(friend.room.id, doorId),
  routeTo: (from, to) => house.routeTo(from, to),
  rng,
  onReaction: (reaction) => events.emit("friend.reaction", { reaction }),
});
tomatoshi = friend;
house.attachFriend(friend);

const recognizer = new GestureRecognizer((gesture) => events.emit("input.gesture", gesture));
attachPointerInput(stage, {
  recognizer,
  boundsOf: (target) => (target === "body" || target === "stem" ? friend.bounds : house.boundsOf(target)),
  onPoint: (x, y) => {
    if (house.friendVisible) friend.point(x, y);
  },
});

events.on("input.gesture", (gesture) => {
  if (house.handle(gesture)) friend.userActive();
  else if (house.friendVisible) friend.handle(gesture);
});
events.on("prop.event", ({ id, kind }) => {
  if (kind === "door" && house.viewed.props.has(id)) house.doorTapped(id);
  // Tomatoshi only notices what happens in the room it's in.
  if (house.room(friend.room.id).props.has(id)) friend.notice(id, kind);
});

events.on("loop.tick", ({ dt }) => {
  recognizer.update(performance.now());
  friend.update(dt);
  house.update(dt);
});

// Remember everything between visits.
const save = () =>
  writeSave(storage, { version: 1, savedAt: Date.now(), friend: friend.save(), world: world.snapshot() });
setInterval(save, 5000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") save();
});
addEventListener("pagehide", save);

if (option("debug")) attachDebugPanel(friend, () => friend.room.light());

friend.greet(secondsAway, saved?.friend.needs.affection);
new Loop((dt, time) => events.emit("loop.tick", { dt, time })).start();
document.body.classList.add("ready"); // fade in

// Installable and playable offline (production builds only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // Not fatal: it just won't work offline.
  });
}
