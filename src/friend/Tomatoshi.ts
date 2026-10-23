// Tomatoshi: position, physics, reactions to touch and autonomous life.
//
// Coordinates: (x, ground) is where its feet touch the floor; `h` is the
// height above that point (when picked up, thrown, or sitting on the couch).
// The shadow stays on the ground, which is what makes height readable in a
// 2.5D room.

import { depthScale } from "../engine/area";
import { between, pick, type Rng } from "../engine/random";
import type { Bounds, Gesture } from "../engine/input";
import type { Surroundings } from "../engine/room";
import { DARK, type Point, type PropEventKind, type UseAction } from "../objects/prop";
import { BODY_CY, BODY_RX, BODY_RY, drawTomatoshi, HEAD_TOP, renderFace, type FaceState } from "./art";
import { blendFace, expressions, type ExpressionName } from "./expressions";
import { SpeechBubble, type BubbleSymbol } from "./bubbles";
import { awayFrom, chooseActivity, useDuration, type Activity, type ActivityKind, type Area } from "./brain";

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
  | "found-bowl-empty";

export interface TomatoshiOptions {
  area: Area;
  room: Surroundings;
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

  private readonly area: Area;
  private readonly room: Surroundings;
  private readonly rng: Rng;
  private readonly onReaction: (reaction: Reaction) => void;

  constructor(options: TomatoshiOptions) {
    this.area = options.area;
    this.room = options.room;
    this.rng = options.rng;
    this.x = options.x;
    this.ground = options.y;
    this.onReaction = options.onReaction ?? (() => {});
    this.blinkTimer = between(this.rng, 1, 4);
  }

  /** Stage units per body unit at the current depth (further away = smaller). */
  get depthScale(): number {
    return depthScale(this.area, this.ground);
  }

  /** Things can bump into it, unless it's being held or flying. */
  get solid(): boolean {
    return this.mode !== "held" && this.mode !== "thrown";
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

    switch (g.type) {
      case "tap":
        if (g.target === "none") this.noticed();
        else if (g.target === "stem") this.stemPoked();
        else this.tapped(g.count);
        break;
      case "longPressStart":
        this.mode = "squished";
        this.squashTarget = 0.28;
        this.say("anger", 30);
        this.onReaction("squished");
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
        this.onReaction("stroked");
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
      this.onReaction("tickled");
    } else {
      this.say(this.rng() < 0.5 ? "exclaim" : "ellipsis", 1.3);
      this.react("annoyed", 1.1);
      this.onReaction("tapped");
    }
  }

  private explode(): void {
    this.tickleExploded = true;
    this.hop(480);
    this.shakeLeft = 1.2;
    this.say("grawlix", 1.8);
    this.onReaction("exploded");
    this.react("furious", 1.5, () => this.stormOff(this.pointer.x));
  }

  private stemPoked(): void {
    this.stemV += pick(this.rng, [-1, 1]) * 420;
    this.squashV += 2;
    this.say("anger", 1.3);
    this.react("annoyed", 1.2);
    this.onReaction("stem-poked");
  }

  private noticed(): void {
    if (this.mode !== "auto" || this.asleep) return;
    if (this.activity?.kind === "sulk") {
      this.react("annoyed", 1);
      this.say("ellipsis", 1.2);
    } else if (this.rng() < 0.35) {
      this.say("question", 1.2);
    }
  }

  private stroked(distance: number): void {
    if (this.mode !== "stroked") return;
    this.strokeAmount += distance;
    this.squashV += distance * 0.004;
    if (this.strokeAmount > STROKE_HEART && !this.heartShown) {
      // It slips out… and is immediately covered up.
      this.heartShown = true;
      this.say("heart", 0.6);
      this.queuedBubble = { symbol: "ellipsis", at: this.time + 0.6, duration: 1.6 };
      this.onReaction("secretly-happy");
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
    this.vx = 0;
    this.vh = 0;
    this.grab = { dx: grabX - this.x, dy: grabY - (this.ground - this.h), heldFor: 0, complained: false };
    this.squashV -= 4; // stretch as it's lifted
    this.say("exclaim", 1.2);
    this.onReaction("picked-up");
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
    this.onReaction(speed < THROW_SPEED ? "dropped" : "thrown");
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
    switch (kind) {
      case "thrown":
        // A moving ball is irresistible (it would never admit it).
        if (free) {
          this.say("exclaim", 0.9);
          this.startUse(propId, "kick", 0.7);
        }
        break;
      case "refilled":
        if (free) {
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
        }
        break;
      case "hit-friend":
        this.bonked(propId);
        break;
    }
  }

  private bonked(propId: string): void {
    this.squashV += 5;
    this.stemV += 500;
    this.shakeLeft = 0.3;
    this.onReaction("bonked");
    if (this.mode === "squished" || this.mode === "stroked") return;
    this.perch = null;
    this.say("grawlix", 1.5);
    // Kicks it right back.
    this.react("angry", 1, () => this.startUse(propId, "kick", 0.7));
  }

  private wakeUp(mood: "angry" | "annoyed"): void {
    this.say("anger", 1.4);
    this.onReaction("woke-up");
    this.react(mood, 1.3);
  }

  private startUse(propId: string, action: UseAction, duration: number): void {
    this.mode = "auto";
    this.storming = false;
    this.activity = { kind: "use", propId, action, duration };
    this.activityTime = 0;
    // Already sitting on it: no need to climb down and back up.
    const settled = this.perch?.propId === propId && (action === "sit" || action === "nap");
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
      this.onReaction("dizzy");
      this.react("dizzy", 1.8, () => {
        this.say("grawlix", 1.6);
        this.react("angry", 1.2, () => this.stormOff(this.x));
      });
    } else if (this.throwSpeed >= THROW_SPEED) {
      this.say("anger", 1.4);
      this.react("angry", 1.3);
    } else {
      this.say("ellipsis", 1.3);
      this.react("annoyed", 1);
    }
  }

  // -------------------------------------------------------------------------
  // Simulation

  update(dt: number): void {
    this.time += dt;
    this.idleFor += dt;
    this.lightChanged(this.room.light());

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

    if (this.queuedBubble && this.time >= this.queuedBubble.at) {
      const { symbol, duration } = this.queuedBubble;
      this.say(symbol, duration);
    }

    this.render(dt);
  }

  private updateAuto(dt: number): void {
    if (!this.activity) {
      this.activity = chooseActivity({
        x: this.x,
        y: this.ground,
        area: this.area,
        idleFor: this.idleFor,
        last: this.lastActivity,
        opportunities: this.room.opportunities(),
        rng: this.rng,
      });
      this.activityTime = 0;
      this.using = { phase: "approach", time: 0, done: false };
      this.startActivity(this.activity);
    }

    const a = this.activity;

    // Anything other than sitting here means getting down first.
    const seated = a.kind === "use" && (a.action === "sit" || a.action === "nap") && this.using.phase === "act";
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
    }
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
      const chasing = a.action === "kick";
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
        break;
      case "eat":
        if (Math.floor(u.time * 7) !== Math.floor((u.time - dt) * 7)) this.squashV += 0.8; // chomp
        if (u.time >= 1.2 && !u.done) {
          u.done = true;
          this.room.use(a.propId, "eat", { x: this.x, y: this.ground });
          this.onReaction("ate");
        }
        break;
      case "inspect":
        if (u.time >= 1.1 && !u.done) {
          // Empty. Whose fault is that?
          u.done = true;
          this.say("anger", 1.4);
          this.onReaction("found-bowl-empty");
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
      case "sit":
      case "nap": {
        const height = this.room.seatHeight(a.propId);
        this.perch = { propId: a.propId, height };
        this.vh = Math.sqrt(2 * GRAVITY * (height + 40));
        if (a.action === "nap") {
          this.queuedBubble = { symbol: "zzz", at: this.time + 1, duration: 2.4 };
          this.onReaction("fell-asleep");
        }
        break;
      }
      case "kick":
        this.room.use(a.propId, "kick", { x: this.x, y: this.ground });
        this.squashV += 3;
        this.vh = 220;
        this.onReaction("kicked-ball");
        break;
    }
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
        this.onReaction("sulking");
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

    // Settle back upright (to the nearest full turn) once not moving.
    if (this.mode !== "thrown") {
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
        }
        return "grumpy";
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
    if (this.time - this.pointer.seenAt < POINTER_ATTENTION) return towardPointer;

    const a = this.activity;
    if (this.mode === "auto" && a?.kind === "use") {
      if (a.action === "nap" && this.using.phase === "act") return { x: 0, y: 0.3 };
      if (a.action === "inspect" && this.using.done) return { x: 0, y: 0.1 }; // at you
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

    p.root.setAttribute(
      "transform",
      `translate(${this.x.toFixed(1)} ${(this.ground - lift).toFixed(1)}) scale(${s.toFixed(3)}) rotate(${this.rot.toFixed(1)} 0 ${BODY_CY})`,
    );
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
    p.stem.setAttribute("transform", `rotate(${this.stem.toFixed(1)} 0 ${stemBase})`);

    const face = this.blinkLeft > 0 && this.face.eyes === "open" ? { ...this.face, lid: 1 } : this.face;
    renderFace(p, face);

    const head = this.headAnchor;
    // Near the right wall the bubble flips to the left so it stays on screen.
    this.bubble.update(dt, head.x, head.y, this.x > 470 ? -1 : 1);
  }
}
