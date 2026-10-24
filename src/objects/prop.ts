// What every room object (prop) can do. A prop draws itself, keeps its
// state in the World, reacts to the user's gestures, and tells Tomatoshi
// what it can do with it (its affordances).

import type { Area } from "../engine/area";
import type { EventBus, GameEvents } from "../engine/events";
import type { Bounds, Gesture } from "../engine/input";
import type { Effects } from "../engine/particles";
import type { Rng } from "../engine/random";
import type { ObjectState, World } from "../engine/world";

/** Below this much light, Tomatoshi gets sleepy. */
export const DARK = 0.35;

export type UseAction = "sit" | "nap" | "kick" | "eat" | "inspect" | "watch" | "visit" | "dance";

/** Something Tomatoshi could choose to do, and how much it feels like it. */
export interface Opportunity {
  propId: string;
  action: UseAction;
  weight: number;
}

/** Things a prop tells the rest of the room about. */
export type PropEventKind =
  | "thrown"
  | "kicked"
  | "refilled"
  | "emptied"
  | "bounced"
  | "hit-friend"
  | "toggled"
  | "watered"
  | "channel";

export interface Point {
  x: number;
  y: number;
}

/** What props may know about Tomatoshi (e.g. to bump into it). */
export interface FriendView {
  readonly x: number;
  readonly ground: number;
  readonly h: number;
  readonly depthScale: number;
  /** False while held or flying: things pass by instead of bonking it. */
  readonly solid: boolean;
}

export interface PropContext {
  world: World;
  events: EventBus<GameEvents>;
  rng: Rng;
  /** Where Tomatoshi can walk. */
  area: Area;
  friend: () => FriendView;
  /** Hour of the day, 0..24. */
  hour: () => number;
  fx: Effects;
}

/** A pool of light in the room. Warm for lamps, cool for screens. */
export interface LightSource {
  x: number;
  y: number;
  radius: number;
  tone: "warm" | "cool";
}

/** A prop as listed in a scene file. */
export interface PropDef {
  id: string;
  type: string;
  x: number;
  y: number;
  state?: ObjectState;
}

export interface Prop {
  readonly id: string;
  /** Wall props sit behind everything; world props are depth-sorted with Tomatoshi. */
  readonly layer: "wall" | "world";
  readonly root: SVGGElement;
  readonly shadow?: SVGElement;
  /** Depth: the y where it touches the floor. */
  sortY(): number;
  update(dt: number): void;
  handle?(g: Gesture): void;
  /** Touch area, so a drag starts when the finger leaves it. */
  bounds?(): Bounds;
  opportunities?(light: number): Opportunity[];
  /** Where Tomatoshi stands to do `action`, or null if it can't right now. */
  spot?(action: UseAction, from: Point): Point | null;
  /** Tomatoshi does `action` with it. */
  use?(action: UseAction, from: Point): void;
  /** Height of the surface Tomatoshi sits on, above the floor at its spot. */
  seatHeight?(): number;
  /** Where to look when using it. */
  focus?(): Point;
  /** Light it lets into the whole room, 0..1. */
  ambientLight?(): number;
  /** A local pool of light. */
  lightSource?(): LightSource | null;
}

export type PropFactory = (def: PropDef, ctx: PropContext) => Prop;

/** Mark a prop's root so touches on it are routed to it. */
export function tagProp(root: SVGGElement, id: string, type: string): void {
  root.dataset.prop = id;
  root.classList.add("prop", `prop-${type}`);
}

export const emitProp = (ctx: PropContext, id: string, kind: PropEventKind) =>
  ctx.events.emit("prop.event", { id, kind });
