// Tomatoshi: position, physics, reactions to touch and autonomous life.
//
// Coordinates: (x, ground) is where its feet touch the floor; `h` is the
// height above that point (when picked up, thrown, or sitting on the couch).
// The shadow stays on the ground, which is what makes height readable in a
// 2.5D room.

import { depthScale } from "../engine/area";
import { between, pick, type Rng } from "../engine/random";
import type { Bounds, Gesture } from "../engine/input";
import type { Effects, ParticleKind } from "../engine/particles";
import { inDanger, type Surroundings } from "../engine/room";
import { THIRSTY } from "../objects/plant";
import { DARK, type DangerKind, type Opportunity, type Point, type PropEventKind, type UseAction } from "../objects/prop";
import { CHANNEL } from "../objects/tv";
import { clampToArea } from "../engine/area";
import { BODY_CY, BODY_RX, BODY_RY, drawTomatoshi, HEAD_TOP, renderFace, type FaceState } from "./art";
import { spamLevel, witness, type Witness } from "./witness";
import { blendFace, expressions, type ExpressionName } from "./expressions";
import { SpeechBubble, type BubbleSymbol } from "./bubbles";
import { awayFrom, chooseActivity, useDuration, type Activity, type ActivityKind, type Area } from "./brain";
import { applyEffect, decayNeeds, DEFAULT_NEEDS, moodOf, type Mood, type Needs } from "./needs";

export type Reaction =
  | "tapped"
  | "tickled"
  | "exploded"
  | "stem-poked"
  | "squished"
  | "stroked"
  | "secretly-happy"
  | "picked-up"
  | "thrown"
  | "dropped"
  | "dizzy"
  | "sulking"
  | "bonked"
  | "fell-asleep"
  | "woke-up"
  | "ate"
  | "kicked-ball"
  | "found-bowl-empty"
  | "caught-dancing"
  | "visited-cousin"
  | "scared"
  | "grumbled"
  | "bathed"
  | "too-hot"
  | "too-cold"
  | "offended"
  | "cried"
  | "came-looking"
  | "came-when-called"
  | "refused"
  | "shook-off-butterfly"
  | "chased"
  | "got-wet"
  | "played"
  | "fed-up"
  | "dropped-on";

/** How each reaction changes its needs. Rough handling costs affection. */
const REACTION_EFFECTS: Partial<Record<Reaction, Partial<Needs>>> = {
  tapped: { affection: 2 },
  tickled: { fun: 6, affection: 1 },
  exploded: { affection: -8 },
  "stem-poked": { affection: -3 },
  squished: { affection: -4 },
  "secretly-happy": { affection: 12 },
  "picked-up": { affection: -1, fun: 2 },
  thrown: { affection: -5, fun: 4 },
  dizzy: { affection: -8 },
  bonked: { affection: -6 },
  "woke-up": { affection: -4 },
  ate: { fullness: 35 },
  "kicked-ball": { fun: 15, energy: -2 },
  "found-bowl-empty": { affection: -3 },
  "caught-dancing": { fun: 5 },
  "visited-cousin": { affection: 10 },
  "scared": { affection: -2 },
  grumbled: { fun: 8 },
  "too-hot": { affection: -1 },
  offended: { affection: -1 },
  cried: { affection: -2 },
  "came-when-called": { affection: 1 },
  "shook-off-butterfly": { fun: 4 },
  chased: { fun: 10, energy: -2 },
  "got-wet": { fun: 3 },
  played: { fun: 6 },
  "fed-up": { affection: -3 },
};
/** Kinds of event that come from its own doings, not yours. */
const OWN_EVENTS = new Set<PropEventKind>(["kicked", "emptied", "hit-friend", "landed", "shooed"]);
/** Fun per second from things it enjoys (and would deny enjoying). */
const FUN_RATE = { dance: 2, tv: 1.2, staticTv: 0.3, bath: 1.8, sprinkler: 3 };
/** Door weights: a little curiosity, more when it misses you or needs something not found here. */
const DOOR_CURIOSITY = 0.25;
const DOOR_MISSING_YOU = 2.5;
const DOOR_NEED = 3;
/** Seconds apart before it comes looking for you (pretending it isn't). */
const MISSES_YOU_AFTER = 15;
/** Seconds for walking through a door. */
const DOOR_TIME = 0.7;
/** Seconds before reacting to the same danger again. */
const DANGER_COOLDOWN = 8;
/** Don't dance while someone touched the screen this recently (seconds). */
const DANCE_SHYNESS = 4;
/** Affection per stage unit of stroking (less as affection gets high). */
const STROKE_AFFECTION = 0.004;

/** What gets saved between visits. */
export interface FriendSave {
  needs: Needs;
  x: number;
  y: number;
  /** The room it was in. */
  room?: string;
}

export interface TomatoshiOptions {
  room: Surroundings;
  /** Called when it walks out through a door. */
  travel?: (doorId: string) => void;
  /** The next room on the way from one room to another (to come find you). */
  routeTo?: (from: string, to: string) => string | null;
  needs?: Needs;
  /** Where to spawn particle effects. */
  fx?: Effects;
  x: number;
  y: number;
  rng: Rng;
  onReaction?: (reaction: Reaction) => void;
}

type Mode = "auto" | "react" | "held" | "thrown" | "squished" | "stroked";

const GRAVITY = 2600;
const WALK_SPEED = 150;
const HOPS_PER_SECOND = 3;
/** How long the eyes keep following the finger after it last moved. */
const POINTER_ATTENTION = 2.5;
/** Stroke distance (stage units) before it can't hide that it likes it. */
const STROKE_HEART = 1400;
/** Release speed above which a drop counts as a throw. */
const THROW_SPEED = 300;
const DIZZY_SPEED = 1400;
/** Keep the top of the stem at least this far below the top of the stage. */
const CEILING = 40;
const MOOD_EXPRESSION: Record<Mood, ExpressionName> = {
  content: "content",
  grumpy: "grumpy",
  veryGrumpy: "annoyed",
  sleepy: "sleepy",
  hungry: "grumpy",
  lonely: "sulky",
};

/** Stem posture per mood: scale x, scale y, and sag (stage units). */
const STEM_POSE: Record<Mood | "angry" | "asleep", { sx: number; sy: number; dy: number }> = {
  content: { sx: 1.05, sy: 1.18, dy: -3 },
  grumpy: { sx: 1, sy: 1, dy: 0 },
  veryGrumpy: { sx: 1.15, sy: 0.92, dy: 0 },
  angry: { sx: 1.25, sy: 0.85, dy: 0 },
  sleepy: { sx: 0.92, sy: 0.7, dy: 5 },
  asleep: { sx: 0.9, sy: 0.62, dy: 7 },
  hungry: { sx: 0.95, sy: 0.8, dy: 3 },
  lonely: { sx: 0.9, sy: 0.68, dy: 5 },
};

/** Gives up walking to something after this long (seconds). */
const APPROACH_TIMEOUT = 12;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const approach = (from: number, to: number, rate: number, dt: number) => to + (from - to) * Math.exp(-rate * dt);

export class Tomatoshi {
  readonly parts = drawTomatoshi();
  readonly bubble = new SpeechBubble();

  x: number;
  ground: number;
  h = 0;
  private vx = 0;
  private vh = 0;
  /** Rotation in degrees around the body center (rolling, wriggling). */
  private rot = 0;

  private mode: Mode = "auto";
  private activity: Activity | null = null;
  private activityTime = 0;
  private lastActivity: ActivityKind | null = null;
  private storming = false;
  private walkPhase = 0;
  private bounce = 0;

  private reactLeft = 0;
  private reactExpression: ExpressionName = "annoyed";
  private afterReact: (() => void) | null = null;

  private face: FaceState = { ...expressions.grumpy, lookX: 0, lookY: 0 };
  private wanderLook = { x: 0, y: 0, timer: 0 };
  private pointer = { x: 0, y: 0, seenAt: -Infinity };
  private blinkTimer = 2;
  private blinkLeft = 0;

  // Springs: squash (+ flattens, - stretches) and stem wiggle (degrees).
  private squash = 0;
  private squashV = 0;
  private squashTarget = 0;
  private stem = 0;
  private stemV = 0;
  private shakeLeft = 0;

  private time = 0;
  private idleFor = 0;
  private strokeAmount = 0;
  private heartShown = false;
  private grab = { dx: 0, dy: 0, heldFor: 0, complained: false };
  private throwSpeed = 0;
  private tickleExploded = false;
  private queuedBubble: { symbol: BubbleSymbol; at: number; duration: number } | null = null;

  /** Sitting on something: the height of its surface above `ground`. */
  private perch: { propId: string; height: number } | null = null;
  /** Progress of a "use" activity: walking there, then doing it. */
  private using = { phase: "approach" as "approach" | "act", time: 0, done: false };
  private lastLight: number | null = null;
  private needs: Needs;
  private readonly fx: Effects;
  private dt = 0;
  // Stem posture follows mood: perky, normal, spiky or droopy.
  private stemPose = { sx: 1, sy: 1, dy: 0 };

  /** The room it's in. Changes when it goes through a door. */
  room: Surroundings;
  /** 0 = invisible (inside a doorway), 1 = fully here. */
  private presence = 1;
  private arrivedFromLooking = false;
  private apartFor = 0;
  private viewer = "";
  private dangerSeen = new Map<string, number>();
  /** Something it's looking at for a moment (an object you just used). */
  private attention: { x: number; y: number; until: number } | null = null;
  /** When each object was last fiddled with, to get fed up with it. */
  private fiddled = new Map<string, number[]>();
  /** Called over by a double tap: glares at you when it gets there. */
  private summoned = false;
  /** Dropped near something: does it once it has landed. */
  private pendingUse: { propId: string; action: UseAction } | null = null;
  /** A butterfly sitting on its stem. */
  private butterfly: string | null = null;
  private readonly travel: (doorId: string) => void;
  private readonly routeTo: (from: string, to: string) => string | null;
  private readonly rng: Rng;
  private readonly onReaction: (reaction: Reaction) => void;

  private reacted(reaction: Reaction): void {
    const effect = REACTION_EFFECTS[reaction];
    if (effect) this.needs = applyEffect(this.needs, effect);
    if (reaction === "secretly-happy" || reaction === "visited-cousin") this.burst("heart", 3);
    if (reaction === "bonked" || reaction === "stem-poked") this.burst("star", 5);
    if (reaction === "tickled" || reaction === "scared") this.burst("sweat", 3);
    this.onReaction(reaction);
  }

  /** Particles from the top of its head. */
  private burst(kind: ParticleKind, count = 1): void {
    const head = this.headAnchor;
    this.fx(kind, head.x + (this.rng() - 0.5) * 60 * this.depthScale, head.y + 20, count);
  }

  /** True once every `interval` seconds (on the frame that crosses it). */
  private every(interval: number): boolean {
    return Math.floor(this.time / interval) !== Math.floor((this.time - this.dt) / interval);
  }

  get dancing(): boolean {
    const a = this.activity;
    return this.mode === "auto" && a?.kind === "use" && a.action === "dance" && this.using.phase === "act";
  }

  constructor(options: TomatoshiOptions) {
    this.room = options.room;
    this.travel = options.travel ?? (() => {});
    this.routeTo = options.routeTo ?? ((_from, to) => to);
    this.viewer = options.room.id;
    this.rng = options.rng;
    this.x = options.x;
    this.ground = options.y;
    this.onReaction = options.onReaction ?? (() => {});
    this.needs = { ...(options.needs ?? DEFAULT_NEEDS) };
    this.fx = options.fx ?? (() => {});
    this.blinkTimer = between(this.rng, 1, 4);
  }

  private get area(): Area {
    return this.room.walkArea;
  }

  /** The room you're looking at. It notices when you come and go. */
  get viewerRoom(): string {
    return this.viewer;
  }

  set viewerRoom(id: string) {
    const before = this.viewer;
    this.viewer = id;
    if (before === id) return;
    const free = this.mode === "auto" && !this.asleep;
    if (id === this.room.id && free) {
      this.say("ellipsis", 1.2); // oh. it's you.
    } else if (before === this.room.id && free) {
      this.say("question", 1); // where are you going?
    }
  }

  /** Walk in through a door of another room. */
  enter(room: Surroundings, at: Point): void {
    this.room = room;
    this.x = at.x;
    this.ground = at.y - 30;
    this.h = 0;
    this.vh = 0;
    this.vx = 0;
    this.perch = null;
    this.presence = 0;
    this.lastLight = null;
    this.mode = "auto";
    this.storming = false;
    this.activity = { kind: "walk", x: at.x, y: Math.min(this.area.maxY, at.y + 70) };
    this.activityTime = 0;
    this.lastActivity = "walk";
    // Came here because you were here? It would never admit it.
    if (room.id === this.viewer && this.arrivedFromLooking) {
      this.queuedBubble = { symbol: "ellipsis", at: this.time + 0.8, duration: 1.4 };
      this.reacted("came-looking");
    }
    this.arrivedFromLooking = false;
  }

  /** Stage units per body unit at the current depth (further away = smaller). */
  get depthScale(): number {
    return depthScale(this.area, this.ground);
  }

  /** The tip of its stem. */
  get headTop(): Point {
    return { x: this.x, y: this.ground - this.h - this.bounce + HEAD_TOP * this.depthScale };
  }

  /** Keeping still (standing, sitting or asleep): a butterfly could land. */
  get idle(): boolean {
    return this.mode === "auto" && this.bounce === 0 && this.h <= this.floorLevel + 1 && this.presence === 1 && !this.dancing;
  }

  /** Things can bump into it, unless it's being held or flying. */
  get solid(): boolean {
    return this.mode !== "held" && this.mode !== "thrown";
  }

  /** What it's up to, in a few words (for the debug panel). */
  get doing(): string {
    const a = this.activity;
    if (this.mode !== "auto") return this.mode === "react" ? `react ${this.reactExpression}` : this.mode;
    if (!a) return "deciding";
    if (a.kind === "use") return `${a.action} ${a.propId} (${this.using.phase})`;
    return a.kind;
  }

  get mood(): Mood {
    return moodOf(this.needs);
  }

  /** A copy of the current needs (0..100 each). */
  get currentNeeds(): Needs {
    return { ...this.needs };
  }

  save(): FriendSave {
    return { needs: { ...this.needs }, x: this.x, y: this.ground, room: this.room.id };
  }

  /**
   * Coming back after a while: it noticed. Not that it missed you.
   * `fondness` is how it felt about you when you left.
   */
  greet(secondsAway: number, fondness = this.needs.affection): void {
    if (secondsAway < 5 * 60) return;
    if (fondness > 65) {
      // A heart slips out before it remembers to be grumpy.
      this.say("heart", 0.6);
      this.queuedBubble = { symbol: "ellipsis", at: this.time + 0.6, duration: 1.4 };
      this.react("secretlyHappy", 2);
      this.burst("heart", 2);
    } else if (fondness < 30) {
      this.say("anger", 1.8);
      this.react("annoyed", 1.6);
    } else {
      this.say("ellipsis", 1.6);
      this.react("annoyed", 1.2);
    }
  }

  get bathing(): boolean {
    const a = this.activity;
    return this.mode === "auto" && a?.kind === "use" && a.action === "bathe" && this.using.phase === "act";
  }

  get asleep(): boolean {
    const a = this.activity;
    return this.mode === "auto" && a?.kind === "use" && a.action === "nap" && this.using.phase === "act";
  }

  private get floorLevel(): number {
    return this.perch?.height ?? 0;
  }

  // -------------------------------------------------------------------------
  // Input

  /** Latest pointer position (pressed or hovering). Eyes follow it. */
  point(x: number, y: number): void {
    this.pointer = { x, y, seenAt: this.time };
  }

  /** The user did something in the room (not to Tomatoshi directly). */
  userActive(): void {
    this.idleFor = 0;
  }

  handle(g: Gesture): void {
    this.idleFor = 0;
    // While flying it can only be caught.
    if (this.mode === "thrown" && g.type !== "dragStart") return;
    if (this.asleep) {
      // Being woken up is the worst. A tap does nothing else.
      this.wakeUp("angry");
      if (g.type === "tap") return;
    }
    if (this.dancing) {
      // Caught! It was NOT dancing.
      this.say("exclaim", 0.7);
      this.queuedBubble = { symbol: "ellipsis", at: this.time + 0.7, duration: 1.4 };
      this.reacted("caught-dancing");
      this.react("annoyed", 1.8);
      if (g.type === "tap") return;
    }

    switch (g.type) {
      case "tap":
        if (g.target === "none") {
          if (g.count === 2) this.comeHere(g.x, g.y);
          else this.noticed(g.x, g.y);
        }
        else if (g.target === "stem") this.stemPoked();
        else this.tapped(g.count);
        break;
      case "longPressStart":
        this.mode = "squished";
        this.squashTarget = 0.28;
        this.say("anger", 30);
        this.reacted("squished");
        break;
      case "longPressEnd":
        this.squashTarget = 0;
        this.squashV -= 6; // pop back with an overshoot
        this.bubble.hide();
        this.react("annoyed", 1);
        break;
      case "strokeStart":
        this.mode = "stroked";
        this.strokeAmount = 0;
        this.heartShown = false;
        this.say("ellipsis", 2);
        this.reacted("stroked");
        break;
      case "stroke":
        this.stroked(g.distance);
        break;
      case "strokeEnd":
        this.strokeEnded();
        break;
      case "dragStart":
        this.pickedUp(g.startX, g.startY);
        break;
      case "dragMove":
        if (this.mode === "held") this.moveHeld(g.x, g.y);
        break;
      case "dragEnd":
        if (this.mode === "held") this.released(g.vx, g.vy);
        break;
    }
  }

  private tapped(count: number): void {
    if (count === 1) this.tickleExploded = false;
    if (count >= 6) {
      if (!this.tickleExploded) this.explode();
      else this.say("grawlix", 1.4);
      return;
    }
    this.hop(count >= 3 ? 200 : 320);
    if (count >= 3) {
      // Trying very hard not to laugh.
      this.shakeLeft = 0.6;
      this.bubble.hide();
      this.react("holdingLaugh", 0.9, () => this.react("annoyed", 0.6));
      this.reacted("tickled");
    } else {
      this.say(this.rng() < 0.5 ? "exclaim" : "ellipsis", 1.3);
      this.react("annoyed", 1.1);
      this.reacted("tapped");
    }
  }

  private explode(): void {
    this.tickleExploded = true;
    this.hop(480);
    this.shakeLeft = 1.2;
    this.say("grawlix", 1.8);
    this.reacted("exploded");
    this.react("furious", 1.5, () => this.stormOff(this.pointer.x));
  }

  private stemPoked(): void {
    this.stemV += pick(this.rng, [-1, 1]) * 420;
    this.squashV += 2;
    this.say("anger", 1.3);
    this.react("annoyed", 1.2);
    this.reacted("stem-poked");
  }

  private noticed(x: number, y: number): void {
    if (this.mode !== "auto" || this.asleep) return;
    this.attention = { x, y, until: this.time + 1.2 };
    if (this.activity?.kind === "sulk") {
      this.react("annoyed", 1);
      this.say("ellipsis", 1.2);
    } else if (this.rng() < 0.35) {
      this.say("question", 1.2);
    }
  }

  /** Double tap on the floor: come here. It comes, grudgingly. Or not at all. */
  private comeHere(x: number, y: number): void {
    if (this.asleep || this.mode === "held" || this.mode === "thrown") return;
    if (y < this.area.minY - 60) return; // that's the wall
    if (this.needs.affection < 30) {
      this.say("anger", 1.4); // no.
      this.reacted("refused");
      this.react("sulky", 1.6);
      return;
    }
    const target = clampToArea(this.area, x, y);
    this.say("ellipsis", 1.2);
    this.mode = "auto";
    this.storming = false;
    this.activity = { kind: "walk", ...target };
    this.activityTime = 0;
    this.summoned = true;
    this.reacted("came-when-called");
  }

  private stroked(distance: number): void {
    if (this.mode !== "stroked") return;
    this.strokeAmount += distance;
    this.squashV += distance * 0.004;
    const diminishing = 1 - this.needs.affection / 120;
    this.needs = applyEffect(this.needs, { affection: distance * STROKE_AFFECTION * diminishing });
    if (this.strokeAmount > STROKE_HEART && !this.heartShown) {
      // It slips out… and is immediately covered up.
      this.heartShown = true;
      this.say("heart", 0.6);
      this.queuedBubble = { symbol: "ellipsis", at: this.time + 0.6, duration: 1.6 };
      this.reacted("secretly-happy");
    } else if (!this.bubble.symbol && !this.queuedBubble) {
      this.say("ellipsis", 1.6);
    }
  }

  private strokeEnded(): void {
    if (this.mode !== "stroked") return;
    if (this.strokeAmount > STROKE_HEART * 0.6) {
      // Caught enjoying it: act offended.
      this.react("secretlyHappy", 0.9, () => {
        this.say("anger", 1.2);
        this.react("annoyed", 1);
      });
    } else {
      this.react("annoyed", 0.8);
    }
  }

  private pickedUp(grabX: number, grabY: number): void {
    this.mode = "held";
    this.activity = null;
    this.perch = null;
    this.pendingUse = null;
    this.vx = 0;
    this.vh = 0;
    this.grab = { dx: grabX - this.x, dy: grabY - (this.ground - this.h), heldFor: 0, complained: false };
    this.squashV -= 4; // stretch as it's lifted
    this.say("exclaim", 1.2);
    this.reacted("picked-up");
  }

  private moveHeld(px: number, py: number): void {
    const x = px - this.grab.dx;
    const y = Math.min(py - this.grab.dy, this.area.maxY);
    this.x = clamp(x, this.area.minX - 20, this.area.maxX + 20);
    this.ground = clamp(y, this.area.minY, this.area.maxY);
    this.h = clamp(this.ground - y, 0, this.maxHeight);
  }

  /** Highest it can be lifted or thrown while staying on screen. */
  private get maxHeight(): number {
    return Math.max(0, this.ground + HEAD_TOP * this.depthScale - CEILING);
  }

  private released(vx: number, vy: number): void {
    const speed = Math.hypot(vx, vy);
    this.throwSpeed = speed;
    if (speed < THROW_SPEED && this.droppedOnto()) return;
    if (speed < THROW_SPEED) {
      this.vx = 0;
      this.vh = 0;
    } else {
      this.vx = clamp(vx, -2200, 2200);
      // Capped so even a hard fling peaks before leaving the top of the screen.
      const rise = this.maxHeight - this.h;
      this.vh = clamp(-vy, -1600, Math.sqrt(2 * GRAVITY * Math.max(0, rise)));
    }
    this.mode = "thrown";
    this.reacted(speed < THROW_SPEED ? "dropped" : "thrown");
  }

  /** Put down on top of something: sit on it, bathe in it, or go and use it. */
  private droppedOnto(): boolean {
    const b = this.bounds;
    const target = this.room.dropTarget({ x: b.cx, y: b.cy });
    if (!target) return false;
    const { propId, action } = target;
    this.reacted("dropped-on");
    if (action === "sit" || action === "nap" || action === "bathe") {
      const spot = this.room.spot(propId, action, { x: this.x, y: this.ground });
      if (!spot) return false;
      // Keep it where it is on screen, then let it settle onto the seat.
      const feetY = this.ground - this.h;
      const seat = this.room.seatHeight(propId);
      this.x = spot.x;
      this.ground = spot.y;
      this.perch = { propId, height: seat };
      this.h = Math.max(seat, spot.y - feetY);
      this.vh = 0;
      this.vx = 0;
      this.startUse(propId, action, useDuration(action, this.rng));
      this.say(action === "bathe" ? "exclaim" : "ellipsis", 1.2);
      return true;
    }
    // Anything else: land first, then (grudgingly) get on with it.
    this.pendingUse = target;
    return false;
  }

  // -------------------------------------------------------------------------
  // Behavior helpers

  private say(symbol: BubbleSymbol, duration: number): void {
    this.queuedBubble = null;
    this.bubble.show(symbol, duration);
  }

  private react(expression: ExpressionName, seconds: number, after?: () => void): void {
    this.mode = "react";
    this.activity = null;
    this.storming = false;
    this.reactExpression = expression;
    this.reactLeft = seconds;
    this.afterReact = after ?? null;
  }

  private hop(speed: number): void {
    if (this.h <= this.floorLevel) this.vh = speed;
  }

  private stormOff(fromX: number): void {
    this.mode = "auto";
    this.storming = true;
    this.activity = { kind: "walk", ...awayFrom(fromX, { y: this.ground, area: this.area, rng: this.rng }) };
    this.activityTime = 0;
  }

  private toAuto(): void {
    this.mode = "auto";
    this.activity = null;
  }

  /** Something happened to an object in the room. */
  notice(propId: string, kind: PropEventKind): void {
    const free = this.mode === "auto" && !this.asleep;
    if (!OWN_EVENTS.has(kind)) {
      // Whatever you did, it looks over.
      const focus = this.room.focus(propId);
      if (focus && !this.asleep) this.attention = { ...focus, until: this.time + 1.6 };
      if (this.fedUp(propId)) return;
    }
    switch (kind) {
      case "thrown":
        if (!free) break;
        if (this.needs.energy < 15) {
          this.say("zzz", 1.4); // too tired to care
        } else {
          // A moving ball is irresistible (it would never admit it).
          this.say("exclaim", 0.9);
          this.startUse(propId, "kick", 0.7);
        }
        break;
      case "refilled":
        if (!free) break;
        if (this.needs.fullness > 85) {
          this.say("ellipsis", 1.4); // not hungry, thanks
        } else {
          this.say("exclaim", 0.9);
          this.startUse(propId, "eat", 2.6);
        }
        break;
      case "bounced":
        if (this.perch?.propId === propId) {
          if (this.asleep) this.wakeUp("angry");
          else {
            this.vh = 420; // bounced right off the cushion
            this.say("anger", 1.2);
            this.react("annoyed", 1.1);
          }
        } else this.witnessed(propId, kind);
        break;
      case "hit-friend":
        this.bonked(propId);
        break;
      case "splashed":
        if (this.bathing && this.perch?.propId === propId) {
          this.squashV += 3;
          this.say("anger", 1.1); // hey!
        } else this.witnessed(propId, kind);
        break;
      case "rattled":
        // The knives. Rattling. On purpose.
        if (this.room.dangers().some((d) => d.propId === propId && d.danger.kind === "sharp") && this.solid && !this.asleep) {
          this.shakeLeft = 0.6;
          this.burst("sweat", 2);
          this.say("exclaim", 1);
          if (this.mode === "auto") this.react("surprised", 0.8);
        }
        break;
      case "channel":
        // A cooking show. With knives. Absolutely not.
        if (this.room.state(propId)?.channel === CHANNEL.cooking && !this.asleep && this.solid) this.scared(propId);
        else this.witnessed(propId, kind);
        break;
      case "landed":
        this.butterflyLanded(propId);
        break;
      case "kicked":
      case "emptied":
      case "hit-friend":
      case "shooed":
        break;
      default:
        this.witnessed(propId, kind);
    }
  }

  /** Fiddling with the same thing over and over: it gets fed up. */
  private fedUp(propId: string): boolean {
    const times = [...(this.fiddled.get(propId) ?? []), this.time].filter((t) => this.time - t < 4);
    this.fiddled.set(propId, times);
    if (this.asleep || !this.solid) return false;
    const level = spamLevel(times, this.time);
    if (level === "furious" && times.length === 7) {
      this.say("grawlix", 1.6);
      this.reacted("fed-up");
      const from = this.room.focus(propId)?.x ?? this.x;
      this.react("furious", 1.3, () => this.stormOff(from));
      return true;
    }
    if (level === "annoyed" && times.length === 4) {
      this.say("anger", 1.4); // stop that
      this.react("annoyed", 1.2);
      return true;
    }
    return level !== "none"; // already said its piece
  }

  /** React to you using an object in its room. */
  private witnessed(propId: string, kind: PropEventKind): void {
    const type = this.room.typeOf(propId);
    if (!type) return;
    const a = this.activity;
    const usingThis = this.mode === "auto" && a?.kind === "use" && a.propId === propId ? a.action : null;
    const w = witness({
      type,
      kind,
      state: this.room.state(propId),
      needs: this.needs,
      mood: this.mood,
      asleep: this.asleep,
      usingThis,
      perchedHere: this.perch?.propId === propId,
    });
    if (w) this.act(w, propId, usingThis !== null);
  }

  private act(w: Witness, propId: string, aboutWhatItsDoing: boolean): void {
    if (w.wake) {
      if (this.asleep) this.wakeUp("annoyed");
      return;
    }
    if (w.affection || w.fun) this.needs = applyEffect(this.needs, { affection: w.affection ?? 0, fun: w.fun ?? 0 });
    if (w.sweat) this.burst("sweat", 3);
    if (w.shiver) this.shakeLeft = 0.7;
    if (w.hearts) this.burst("heart", w.hearts);
    if (w.say) this.say(w.say, 1.3);
    if (this.mode !== "auto") return; // busy being held, stroked, etc.: a bubble is all
    if (w.go) {
      this.startUse(propId, w.go, useDuration(w.go, this.rng));
      return;
    }
    // Doing something else with its hands full: just a look and a bubble.
    const busy = this.activity?.kind === "use" && this.using.phase === "act" && !aboutWhatItsDoing;
    if (w.express && !busy) this.react(w.express, w.seconds ?? 1);
  }

  /** A butterfly landed on its stem. It freezes, goes cross-eyed, blushes… then shoos it. */
  private butterflyLanded(propId: string): void {
    if (this.asleep || this.mode !== "auto") return; // it'll fly off on its own
    this.butterfly = propId;
    this.say("ellipsis", 1.6);
    this.react("flustered", 2.6, () => {
      this.shakeLeft = 0.5;
      this.stemV += 500;
      this.room.use(propId, "chase", { x: this.x, y: this.ground });
      this.butterfly = null;
      this.say("anger", 1);
      this.reacted("shook-off-butterfly");
      this.react("annoyed", 0.8);
    });
  }

  /** Wandered too close to something unpleasant. */
  private avoid(propId: string, kind: DangerKind, fromX: number): void {
    this.dangerSeen.set(propId, this.time);
    switch (kind) {
      case "sharp":
        this.scared(propId);
        return;
      case "hot":
        this.burst("sweat", 3);
        this.say("exclaim", 1);
        this.hop(300);
        this.reacted("too-hot");
        this.react("surprised", 0.6, () => this.stormOff(fromX));
        return;
      case "cold":
        this.shakeLeft = 0.8;
        this.say("ellipsis", 1.2);
        this.reacted("too-cold");
        this.react("annoyed", 0.9, () => this.stormOff(fromX));
        return;
      case "offensive":
        this.say("anger", 1.4);
        this.reacted("offended");
        this.react("angry", 1.1, () => this.stormOff(fromX));
        return;
      case "scary":
        this.scared(propId);
        return;
      case "wet":
        // Shakes it off… and doesn't hate it as much as it pretends.
        this.shakeLeft = 0.6;
        this.burst("drop", 4);
        this.say("ellipsis", 1.2);
        this.reacted("got-wet");
        this.react("content", 1);
        return;
      case "onion":
        this.reacted("cried");
        this.crying = 2.2;
        this.say("ellipsis", 1.6);
        this.react("sulky", 1.6, () => this.stormOff(fromX));
        return;
    }
  }

  private crying = 0;

  /** Check whether it has wandered into something it should avoid. */
  private checkDangers(): void {
    if (this.mode !== "auto" || this.perch || this.h > 0 || this.asleep) return;
    // While doing something on purpose (eating from the open fridge, say), it puts up with it.
    if (this.activity?.kind === "use") return;
    for (const { propId, danger } of this.room.dangers()) {
      const last = this.dangerSeen.get(propId) ?? -Infinity;
      if (this.time - last < DANGER_COOLDOWN) continue;
      if (inDanger(this.x, this.ground, danger)) {
        this.avoid(propId, danger.kind, danger.x);
        return;
      }
    }
  }

  private scared(fromPropId: string): void {
    this.perch = null;
    this.say("exclaim", 1.2);
    this.reacted("scared");
    this.hop(380);
    const from = this.room.focus(fromPropId)?.x ?? this.x;
    this.react("surprised", 0.9, () => {
      this.say("anger", 1.4);
      this.stormOff(from);
    });
  }

  private bonked(propId: string): void {
    this.squashV += 5;
    this.stemV += 500;
    this.shakeLeft = 0.3;
    this.reacted("bonked");
    if (this.mode === "squished" || this.mode === "stroked") return;
    this.perch = null;
    this.say("grawlix", 1.5);
    // Kicks it right back.
    this.react("angry", 1, () => this.startUse(propId, "kick", 0.7));
  }

  private wakeUp(mood: "angry" | "annoyed"): void {
    this.say("anger", 1.4);
    this.reacted("woke-up");
    this.react(mood, 1.3);
  }

  private startUse(propId: string, action: UseAction, duration: number): void {
    this.mode = "auto";
    this.storming = false;
    this.activity = { kind: "use", propId, action, duration };
    this.activityTime = 0;
    // Already sitting on it: no need to climb down and back up.
    const settled = this.perch?.propId === propId && (action === "sit" || action === "nap" || action === "bathe");
    this.using = { phase: settled ? "act" : "approach", time: 0, done: false };
  }

  /** Light changed across the sleepy threshold. */
  private lightChanged(light: number): void {
    const last = this.lastLight;
    this.lastLight = light;
    if (last === null) return;
    if (light < DARK && last >= DARK && this.mode === "auto" && !this.asleep) {
      // Who turned off the lights? …well, nap time.
      this.say("question", 1.2);
      const nap = this.room.opportunities().find((o) => o.action === "nap");
      if (nap) this.startUse(nap.propId, "nap", useDuration("nap", this.rng));
    } else if (light >= DARK && last < DARK && this.asleep) {
      this.wakeUp("annoyed");
    }
  }

  private landedFromThrow(): void {
    this.vx = 0;
    if (this.throwSpeed >= DIZZY_SPEED) {
      this.bubble.hide();
      this.say("dizzy", 1.6);
      this.reacted("dizzy");
      this.react("dizzy", 1.8, () => {
        this.say("grawlix", 1.6);
        this.react("angry", 1.2, () => this.stormOff(this.x));
      });
    } else if (this.throwSpeed >= THROW_SPEED) {
      this.say("anger", 1.4);
      this.react("angry", 1.3);
    } else {
      this.say("ellipsis", 1.3);
      const next = this.pendingUse;
      this.pendingUse = null;
      if (next) this.react("annoyed", 0.6, () => this.startUse(next.propId, next.action, useDuration(next.action, this.rng)));
      else this.react("annoyed", 1);
    }
  }

  // -------------------------------------------------------------------------
  // Simulation

  update(dt: number): void {
    this.time += dt;
    this.dt = dt;
    this.idleFor += dt;
    this.lightChanged(this.room.light());
    if (this.viewer !== this.room.id) this.apartFor += dt;
    else this.apartFor = 0;
    if (this.presence < 1 && !this.leaving) this.presence = Math.min(1, this.presence + dt * 2);
    this.crying = Math.max(0, this.crying - dt);
    if (this.every(0.25)) this.checkDangers();
    this.needs = decayNeeds(this.needs, dt, this.asleep ? "asleep" : this.perch ? "sitting" : "awake");

    switch (this.mode) {
      case "auto":
        this.updateAuto(dt);
        break;
      case "react":
        this.reactLeft -= dt;
        if (this.reactLeft <= 0) {
          const after = this.afterReact;
          this.afterReact = null;
          if (after) after();
          else this.toAuto();
        }
        break;
      case "held":
        this.grab.heldFor += dt;
        if (this.grab.heldFor > 2.5 && !this.grab.complained) {
          this.grab.complained = true;
          this.say("anger", 1.5);
        }
        break;
    }

    this.updatePhysics(dt);
    this.updateSprings(dt);
    this.updateFace(dt);
    this.updateEffects();

    if (this.queuedBubble && this.time >= this.queuedBubble.at) {
      const { symbol, duration } = this.queuedBubble;
      this.say(symbol, duration);
    }

    this.render(dt);
  }

  /** Continuous effects that go with what it's doing. */
  private updateEffects(): void {
    const head = this.headAnchor;
    const s = this.depthScale;
    const fuming = this.mode === "react" && (this.reactExpression === "angry" || this.reactExpression === "furious");
    if (fuming && this.every(0.12)) {
      // Steam out of both sides of the head.
      const side = this.rng() < 0.5 ? -1 : 1;
      this.fx("steam", head.x + side * 70 * s, head.y + 40 * s);
    }
    if (this.asleep && this.every(1.3)) this.fx("z", head.x + 30 * s, head.y + 10);
    if (this.mode === "held" && this.every(0.35)) this.burst("sweat");
    if (this.mode === "react" && this.reactExpression === "holdingLaugh" && this.every(0.25)) this.burst("sweat");
    if (this.mode === "react" && this.reactExpression === "dizzy" && this.every(0.22)) this.burst("star");
    if (this.crying > 0 && this.every(0.18)) {
      // Onion tears, from both eyes.
      const side = this.rng() < 0.5 ? -1 : 1;
      this.fx("drop", this.x + side * 38 * s, this.ground - this.h + (BODY_CY + 4) * s);
    }
    if (this.bathing && this.every(0.3)) this.fx("drop", this.x + (this.rng() - 0.5) * 120 * s, head.y + 160 * s);
  }

  private updateAuto(dt: number): void {
    if (!this.activity) {
      this.activity = chooseActivity({
        x: this.x,
        y: this.ground,
        area: this.area,
        idleFor: this.idleFor,
        last: this.lastActivity,
        opportunities: this.weighDoors(
          this.room
            .opportunities()
            // It only dances when it thinks nobody is looking.
            .filter((o) => o.action !== "dance" || this.time - this.pointer.seenAt > DANCE_SHYNESS),
        ),
        needs: this.needs,
        avoid: (p) => this.room.dangers().some(({ danger }) => inDanger(p.x, p.y, danger)),
        rng: this.rng,
      });
      this.activityTime = 0;
      this.using = { phase: "approach", time: 0, done: false };
      this.startActivity(this.activity);
    }

    const a = this.activity;

    // Anything other than sitting here means getting down first.
    const seated =
      a.kind === "use" && (a.action === "sit" || a.action === "nap" || a.action === "bathe") && this.using.phase === "act";
    if (this.perch && !seated) {
      this.perch = null;
      this.vh = 300;
    }
    if (this.h > this.floorLevel || this.vh > 0) return; // mid-hop

    this.activityTime += dt;
    let done = false;

    if (a.kind === "walk") {
      done = this.walkToward(a, dt, this.storming ? 1.8 : 1);
    } else if (a.kind === "use") {
      done = this.updateUse(a, dt);
    } else {
      done = this.activityTime >= a.duration;
    }

    if (done) {
      this.lastActivity = a.kind;
      this.activity = null;
      this.storming = false;
      if (this.summoned && a.kind === "walk") {
        // Here. What do you want.
        this.summoned = false;
        this.activity = { kind: "glareAtYou", duration: 1.8 };
        this.activityTime = 0;
        this.say("ellipsis", 1.4);
      }
    }
  }

  /**
   * Doors are a little interesting on their own. More so when you've been in
   * another room for a while (it'll come find you), or when what it needs
   * isn't here (no couch to nap on, nothing to eat).
   */
  private weighDoors(opportunities: Opportunity[]): Opportunity[] {
    const offers = (action: UseAction) => opportunities.some((o) => o.action === action && o.weight > 0);
    const tired = this.needs.energy < 25 || this.room.light() < DARK;
    const needUnmet = (tired && !offers("nap")) || (this.needs.fullness < 30 && !offers("eat"));
    return opportunities.map((o) => {
      if (o.action !== "leave") return o;
      const to = this.room.state(o.propId)?.to;
      const towardYou = this.viewer !== this.room.id ? this.routeTo(this.room.id, this.viewer) : null;
      const missesYou = to === towardYou && this.apartFor > MISSES_YOU_AFTER;
      return { ...o, weight: DOOR_CURIOSITY + (missesYou ? DOOR_MISSING_YOU : 0) + (needUnmet ? DOOR_NEED : 0) };
    });
  }

  private get leaving(): boolean {
    const a = this.activity;
    return this.mode === "auto" && a?.kind === "use" && a.action === "leave" && this.using.phase === "act";
  }

  /** Step toward a point. Returns true on arrival. */
  private walkToward(target: Point, dt: number, speed: number): boolean {
    const dx = target.x - this.x;
    const dy = target.y - this.ground;
    const dist = Math.hypot(dx, dy);
    const step = WALK_SPEED * speed * this.depthScale * dt;
    this.walkPhase += dt * HOPS_PER_SECOND * Math.sqrt(speed);
    if (dist <= step) {
      this.x = target.x;
      this.ground = target.y;
      this.walkPhase = 0;
      this.squashV += 1.5;
      return true;
    }
    this.x += (dx / dist) * step;
    this.ground += (dy / dist) * step;
    return false;
  }

  /** Walk to an object, then use it. Returns true when finished. */
  private updateUse(a: Extract<Activity, { kind: "use" }>, dt: number): boolean {
    const u = this.using;

    if (u.phase === "approach") {
      const spot = this.room.spot(a.propId, a.action, { x: this.x, y: this.ground });
      if (!spot || this.activityTime > APPROACH_TIMEOUT) return true;
      const chasing = a.action === "kick" || a.action === "chase";
      if (!this.walkToward(spot, dt, chasing ? 1.6 : 1)) return false;
      u.phase = "act";
      u.time = 0;
      this.beginUse(a);
      return false;
    }

    u.time += dt;
    switch (a.action) {
      case "nap":
        if (u.time % 3.2 < dt) this.say("zzz", 2.4);
        // Fully rested and it's light: wake up on its own.
        if (this.needs.energy >= 98 && this.room.light() >= DARK) return true;
        break;
      case "eat":
        if (Math.floor(u.time * 7) !== Math.floor((u.time - dt) * 7)) {
          this.squashV += 0.8; // chomp
          const mouthY = this.ground - this.h + (BODY_CY + 34) * this.depthScale;
          if (this.rng() < 0.5) this.fx("crumb", this.x + 30 * this.depthScale, mouthY);
        }
        if (u.time >= 1.2 && !u.done) {
          u.done = true;
          this.room.use(a.propId, "eat", { x: this.x, y: this.ground });
          this.reacted("ate");
        }
        break;
      case "watch": {
        const channel = this.room.state(a.propId)?.channel;
        if (channel === CHANNEL.off || channel === undefined) return true;
        if (channel === CHANNEL.static) {
          if (u.time > 1 && this.every(2.6)) this.say("anger", 1.2); // fix your TV
          this.needs = applyEffect(this.needs, { fun: FUN_RATE.staticTv * dt });
        } else {
          this.needs = applyEffect(this.needs, { fun: FUN_RATE.tv * dt });
        }
        break;
      }
      case "visit":
        if (u.time >= 0.7 && !u.done) {
          u.done = true;
          const water = this.room.state(a.propId)?.water;
          if (typeof water === "number" && water < THIRSTY) {
            this.say("anger", 1.6); // its cousin is thirsty, and whose fault is that?
          } else {
            this.say("heart", 1.3); // the one heart it doesn't hide
            this.reacted("visited-cousin");
          }
        }
        break;
      case "dance":
        if (this.room.state(a.propId)?.on === false) return true;
        this.needs = applyEffect(this.needs, { fun: FUN_RATE.dance * dt });
        if (this.every(2.2) && !this.bubble.symbol) this.say("note", 1.2);
        break;
      case "leave":
        // Into the doorway, fading out; then it's in the other room.
        this.presence = Math.max(0, 1 - u.time / DOOR_TIME);
        this.ground -= 50 * dt;
        if (u.time >= DOOR_TIME) {
          this.arrivedFromLooking =
            this.room.state(a.propId)?.to === this.routeTo(this.room.id, this.viewer) && this.apartFor > MISSES_YOU_AFTER;
          this.travel(a.propId);
          return false; // `enter` has given it something new to do
        }
        break;
      case "bathe":
        this.needs = applyEffect(this.needs, { fun: FUN_RATE.bath * dt });
        if (u.time > 1.8 && !u.done) {
          u.done = true;
          this.say("note", 1.4); // …this is actually nice
          this.reacted("bathed");
        }
        break;
      case "play":
        // Hopping around in the sprinkler. Grumpy at first.
        if (this.room.state(a.propId)?.on === false) return true;
        this.needs = applyEffect(this.needs, { fun: FUN_RATE.sprinkler * dt });
        if (this.every(0.7) && this.h <= 0) {
          this.vh = 280;
          this.x = clamp(this.x + (this.rng() - 0.5) * 60, this.area.minX, this.area.maxX);
          this.burst("drop", 2);
        }
        if (u.time > 2 && !u.done) {
          u.done = true;
          this.say("note", 1.4);
          this.reacted("played");
        }
        break;
      case "chase":
        // Pounce! …and miss. Every time.
        if (!u.done) {
          u.done = true;
          this.vh = 480;
          this.room.use(a.propId, "chase", { x: this.x, y: this.ground });
          this.reacted("chased");
          this.queuedBubble = { symbol: "anger", at: this.time + 0.4, duration: 1.2 };
        }
        break;
      case "grumble":
        if (u.time >= 0.6 && !u.done) {
          u.done = true;
          this.say(this.rng() < 0.5 ? "anger" : "ellipsis", 1.6);
          this.reacted("grumbled");
        }
        break;
      case "inspect":
        if (u.time >= 1.1 && !u.done) {
          // Empty. Whose fault is that?
          u.done = true;
          this.say("anger", 1.4);
          this.reacted("found-bowl-empty");
        }
        break;
    }

    if (u.time < a.duration) return false;
    if (a.action === "eat") {
      // Tasty. Not that it would say so.
      this.react("secretlyHappy", 0.8, () => {
        this.say("ellipsis", 1.2);
        this.toAuto();
      });
    }
    return true;
  }

  private beginUse(a: Extract<Activity, { kind: "use" }>): void {
    switch (a.action) {
      case "leave":
        this.room.use(a.propId, "leave", { x: this.x, y: this.ground });
        break;
      case "bathe":
        this.room.use(a.propId, "bathe", { x: this.x, y: this.ground });
        this.hopOnto(a.propId);
        break;
      case "sit":
        this.hopOnto(a.propId);
        break;
      case "nap":
        this.hopOnto(a.propId);
        this.queuedBubble = { symbol: "zzz", at: this.time + 1, duration: 2.4 };
        this.reacted("fell-asleep");
        break;
      case "kick":
        this.room.use(a.propId, "kick", { x: this.x, y: this.ground });
        this.squashV += 3;
        this.vh = 220;
        this.reacted("kicked-ball");
        break;
    }
  }

  /** Jump up onto something to sit on (the couch, into the sink). */
  private hopOnto(propId: string): void {
    const height = this.room.seatHeight(propId);
    this.perch = { propId, height };
    this.vh = Math.sqrt(2 * GRAVITY * (height + 40));
  }

  private startActivity(a: Activity): void {
    switch (a.kind) {
      case "mutter":
        this.say(a.symbol, a.duration);
        break;
      case "glareAtYou":
        if (this.rng() < 0.5) this.say("ellipsis", a.duration);
        break;
      case "sulk":
        this.say("ellipsis", 2);
        this.reacted("sulking");
        break;
    }
  }

  private updatePhysics(dt: number): void {
    // Walking hop is purely visual.
    const a = this.activity;
    const walking =
      this.mode === "auto" &&
      this.h <= this.floorLevel &&
      (a?.kind === "walk" || (a?.kind === "use" && this.using.phase === "approach"));
    this.bounce = walking ? Math.abs(Math.sin(this.walkPhase * Math.PI)) * (this.storming ? 22 : 16) : 0;
    if (this.dancing) {
      // Two bounces a second, swaying side to side.
      this.bounce = Math.abs(Math.sin(this.time * Math.PI * 2)) * 14;
      this.rot = Math.sin(this.time * Math.PI * 2) * 8;
    }

    if (this.mode === "held") {
      this.rot = Math.sin(this.time * 13) * 6; // wriggling
      return;
    }

    const floor = this.floorLevel;
    if (this.h > floor || this.vh > 0) {
      this.vh -= GRAVITY * dt;
      this.h += this.vh * dt;
      if (this.mode === "thrown") this.rot += this.vx * dt * 0.15;
      if (this.h <= floor && this.vh < 0) {
        const impact = -this.vh;
        this.h = floor;
        this.vh = 0;
        if (impact > 450) this.fx("dust", this.x, this.ground - floor, Math.min(6, Math.round(impact / 250)));
        this.squashV += impact * 0.006;
        if (this.mode === "thrown") {
          if (impact > 650) this.vh = impact * 0.35; // bounce
          else if (Math.abs(this.vx) < 250) this.landedFromThrow();
        }
      }
    }

    if (this.vx !== 0) {
      this.x += this.vx * dt;
      const minX = this.area.minX - 20;
      const maxX = this.area.maxX + 20;
      if (this.x < minX || this.x > maxX) {
        this.x = clamp(this.x, minX, maxX);
        this.vx = -this.vx * 0.6;
        this.squashV += 3;
        this.stemV += 300;
      }
      if (this.h <= 0) {
        // Rolling along the floor.
        this.vx *= Math.exp(-2.2 * dt);
        this.rot += ((this.vx * dt) / (BODY_RX * this.depthScale)) * (180 / Math.PI);
        if (Math.abs(this.vx) < 60 && this.mode === "thrown") this.landedFromThrow();
      }
    }

    // Put down gently on the floor (or already rolled to a stop): done flying.
    if (this.mode === "thrown" && this.h <= this.floorLevel && this.vh <= 0 && Math.abs(this.vx) < 60) this.landedFromThrow();

    // Settle back upright (to the nearest full turn) once not moving.
    if (this.mode !== "thrown" && !this.dancing) {
      const upright = Math.round(this.rot / 360) * 360;
      this.rot = approach(this.rot, upright, 8, dt);
      if (Math.abs(this.rot - upright) < 0.5) this.rot = 0;
    }
  }

  private updateSprings(dt: number): void {
    const steps = Math.ceil(dt / (1 / 120));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.squashV += (220 * (this.squashTarget - this.squash) - 11 * this.squashV) * h;
      this.squash += this.squashV * h;
      this.stemV += (-260 * this.stem - 7 * this.stemV) * h;
      this.stem += this.stemV * h;
    }
    this.squash = clamp(this.squash, -0.35, 0.45);
    this.shakeLeft = Math.max(0, this.shakeLeft - dt);
  }

  private currentExpression(): ExpressionName {
    switch (this.mode) {
      case "react":
        return this.reactExpression;
      case "held":
        return "outraged";
      case "thrown":
        return this.throwSpeed >= THROW_SPEED ? "surprised" : "outraged";
      case "squished":
        return "squished";
      case "stroked":
        return this.strokeAmount > STROKE_HEART * 0.6 ? "secretlyHappy" : "flustered";
      case "auto": {
        const a = this.activity;
        if (this.storming) return "annoyed";
        if (a?.kind === "sulk") return "sulky";
        if (a?.kind === "glareAtYou") return "annoyed";
        if (a?.kind === "use" && this.using.phase === "act") {
          if (a.action === "nap") return "asleep";
          if (a.action === "eat") return Math.floor(this.using.time * 7) % 2 ? "chompOpen" : "chompShut";
          if (a.action === "inspect") return this.using.done ? "annoyed" : "sulky";
          if (a.action === "dance") return "dancing";
          if (a.action === "bathe") return this.using.time < 1.8 ? "annoyed" : "content";
          if (a.action === "grumble") return "annoyed";
          if (a.action === "play") return this.using.time < 2 ? "annoyed" : "content";
          if (a.action === "chase") return "angry";
          if (a.action === "visit") return this.bubble.symbol === "anger" ? "annoyed" : "content";
          if (a.action === "watch") return this.room.state(a.propId)?.channel === CHANNEL.static ? "annoyed" : "grumpy";
        }
        return MOOD_EXPRESSION[this.mood];
      }
    }
  }

  private lookTarget(dt: number): { x: number; y: number } {
    const headY = this.ground - this.h + BODY_CY * this.depthScale;
    const towardPointer = {
      x: clamp((this.pointer.x - this.x) / 250, -1, 1),
      y: clamp((this.pointer.y - headY) / 350, -1, 1),
    };

    if (this.mode === "stroked") return { x: towardPointer.x > 0 ? -0.9 : 0.9, y: 0.35 };
    if (this.mode === "react" && this.reactExpression === "dizzy") return { x: 0, y: 0 };
    if (this.asleep) return { x: 0, y: 0.3 };
    if (this.butterfly) return { x: 0, y: -1 }; // cross-eyed at the thing on its head
    const att = this.attention;
    if (att && this.time < att.until) {
      return { x: clamp((att.x - this.x) / 250, -1, 1), y: clamp((att.y - headY) / 350, -1, 1) };
    }
    if (this.time - this.pointer.seenAt < POINTER_ATTENTION) return towardPointer;

    const a = this.activity;
    if (this.mode === "auto" && a?.kind === "use") {
      if (a.action === "nap" && this.using.phase === "act") return { x: 0, y: 0.3 };
      if (a.action === "inspect" && this.using.done) return { x: 0, y: 0.1 }; // at you
      if (a.action === "visit" && this.using.done && this.bubble.symbol === "anger") return { x: 0, y: 0.1 };
      if (a.action === "dance" && this.using.phase === "act") return { x: Math.sin(this.time * Math.PI) * 0.5, y: -0.2 };
      const focus = this.room.focus(a.propId);
      if (focus) return { x: clamp((focus.x - this.x) / 200, -1, 1), y: clamp((focus.y - headY) / 250, -1, 1) };
    }
    if (this.mode === "auto" && a) {
      if (a.kind === "walk") return { x: Math.sign(a.x - this.x) * 0.8, y: 0.15 };
      if (a.kind === "glareAtYou") return { x: 0, y: 0.1 };
      if (a.kind === "sulk") return { x: this.x < 360 ? -0.9 : 0.9, y: 0.4 };
    }

    // Idle glances around the room.
    this.wanderLook.timer -= dt;
    if (this.wanderLook.timer <= 0) {
      const busy = a?.kind === "lookAround";
      this.wanderLook = {
        x: between(this.rng, -1, 1) * (busy ? 1 : 0.5),
        y: between(this.rng, -0.6, 0.4) * (busy ? 1 : 0.5),
        timer: busy ? between(this.rng, 0.6, 1.2) : between(this.rng, 1.5, 3.5),
      };
    }
    return this.wanderLook;
  }

  private updateFace(dt: number): void {
    const look = this.lookTarget(dt);
    const target: FaceState = { ...expressions[this.currentExpression()], lookX: look.x, lookY: look.y };
    this.face = blendFace(this.face, target, dt);

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkLeft = 0.13;
      this.blinkTimer = between(this.rng, 2, 5.5);
    }
    this.blinkLeft = Math.max(0, this.blinkLeft - dt);
  }

  // -------------------------------------------------------------------------
  // Rendering

  /** The body on screen, for telling a rub (stays on it) from a drag (leaves it). */
  get bounds(): Bounds {
    const s = this.depthScale;
    return {
      cx: this.x,
      cy: this.ground - this.h - this.bounce + BODY_CY * s,
      rx: BODY_RX * s,
      ry: BODY_RY * s,
    };
  }

  /** Where speech bubbles point to: just above the head. */
  get headAnchor(): { x: number; y: number } {
    const s = this.depthScale;
    return { x: this.x, y: this.ground - this.h - this.bounce + (BODY_CY - BODY_RY - 10) * s };
  }

  private render(dt: number): void {
    const p = this.parts;
    const s = this.depthScale;
    const lift = this.h + this.bounce;

    // Going through a door: a little smaller and fading.
    const through = 0.85 + 0.15 * this.presence;
    // Sitting on something that moves (a swinging hammock): move with it.
    const seat = this.perch && this.h <= this.floorLevel + 1 ? this.room.seatMotion(this.perch.propId) : { dx: 0, rot: 0 };
    p.root.setAttribute(
      "transform",
      `translate(${(this.x + seat.dx).toFixed(1)} ${(this.ground - lift).toFixed(1)}) scale(${(s * through).toFixed(3)}) rotate(${(this.rot + seat.rot).toFixed(1)} 0 ${BODY_CY})`,
    );
    p.root.setAttribute("opacity", this.presence.toFixed(3));
    p.shadow.setAttribute("opacity", this.presence.toFixed(3));
    // When sitting on something the shadow falls on its surface.
    const surface = this.ground - this.floorLevel;
    const shadowScale = s / (1 + (lift - this.floorLevel) / 250);
    p.shadow.setAttribute("transform", `translate(${this.x.toFixed(1)} ${surface.toFixed(1)}) scale(${shadowScale.toFixed(3)})`);

    const slow = this.asleep || this.activity?.kind === "sulk";
    const breath = Math.sin(this.time * (slow ? 1.4 : 2.4)) * (this.asleep ? 0.035 : 0.02);
    const sy = 1 - this.squash + breath;
    const sx = 1 + this.squash * 0.8 - breath * 0.5;
    const shake = this.shakeLeft > 0 ? Math.sin(this.time * 70) * 5 : 0;
    p.body.setAttribute("transform", `translate(${shake.toFixed(1)} 0) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`);

    p.feet.forEach((foot, i) => {
      if (this.mode === "held") {
        // Legs dangle and kick.
        const kick = Math.sin(this.time * 16 + i * Math.PI) * 22;
        foot.setAttribute("transform", `translate(0 16) rotate(${kick.toFixed(1)} ${i === 0 ? -42 : 42} -8)`);
      } else if (this.bounce > 0) {
        const lift = Math.max(0, Math.sin(this.walkPhase * Math.PI * 2 + i * Math.PI)) * 6;
        foot.setAttribute("transform", `translate(0 ${(-lift).toFixed(1)})`);
      } else {
        foot.removeAttribute("transform");
      }
    });

    const stemBase = BODY_CY - BODY_RY + 6;
    const angry = this.mode === "react" && ["angry", "furious", "annoyed"].includes(this.reactExpression);
    const pose = STEM_POSE[this.asleep ? "asleep" : angry ? "angry" : this.mood];
    const sp = this.stemPose;
    sp.sx = approach(sp.sx, pose.sx, 4, dt);
    sp.sy = approach(sp.sy, pose.sy, 4, dt);
    sp.dy = approach(sp.dy, pose.dy, 4, dt);
    p.stem.setAttribute(
      "transform",
      `translate(0 ${sp.dy.toFixed(2)}) rotate(${this.stem.toFixed(1)} 0 ${stemBase}) ` +
        `translate(0 ${stemBase}) scale(${sp.sx.toFixed(3)} ${sp.sy.toFixed(3)}) translate(0 ${-stemBase})`,
    );

    const face = this.blinkLeft > 0 && this.face.eyes === "open" ? { ...this.face, lid: 1 } : this.face;
    renderFace(p, face);

    const head = this.headAnchor;
    // Near the right wall the bubble flips to the left so it stays on screen.
    this.bubble.update(dt, head.x, head.y, this.x > 470 ? -1 : 1);
  }
}
