// A room built from a scene definition: backdrop, props, particles, lighting
// and depth sorting, all in its own layer group so rooms can be swapped.
// Also what Tomatoshi sees of its surroundings.

import type { Area } from "./area";
import type { Bounds, Gesture } from "./input";
import { propIdOf } from "./input";
import { Particles, type Effects } from "./particles";
import { svgEl, STAGE_HEIGHT, STAGE_WIDTH } from "./stage";
import type { ObjectState, World } from "./world";
import type {
  Danger,
  LightSource,
  Opportunity,
  Point,
  Prop,
  PropContext,
  PropDef,
  PropFactory,
  UseAction,
} from "../objects/prop";

/** Puzzle hook (not interpreted yet): when the conditions hold, do the actions. */
export interface TriggerDef {
  when: string[];
  then: string[];
}

/** A room as data. Doors to other rooms are props of type "door". */
export interface SceneDef {
  id: string;
  backdrop: string;
  walkArea: Area;
  /** Where Tomatoshi starts on a first visit. */
  start: Point;
  objects: PropDef[];
  triggers: TriggerDef[];
}

/** What Tomatoshi can ask about the room it's in. */
export interface Surroundings {
  readonly id: string;
  readonly walkArea: Area;
  /** Overall light, 0 (pitch dark) .. 1. */
  light(): number;
  opportunities(): Opportunity[];
  spot(propId: string, action: UseAction, from: Point): Point | null;
  use(propId: string, action: UseAction, from: Point): void;
  seatHeight(propId: string): number;
  focus(propId: string): Point | null;
  /** An object's current state (e.g. the TV's channel). */
  state(propId: string): Readonly<ObjectState> | null;
  /** Places it would rather not be near right now. */
  dangers(): { propId: string; danger: Danger }[];
}

export type RoomLayer = "background" | "wall" | "shadows" | "world" | "effects" | "lighting";

/** Darkness overlay color and how dark "no light at all" gets. */
const NIGHT_TINT = "#141a3a";
const MAX_DARKNESS = 0.7;
const BLEED = 1200;
/** How fast the visible darkness follows the actual light (per second). */
const LIGHT_EASE = 5;

interface LightPool {
  hole: SVGCircleElement;
  glow: SVGCircleElement;
  /** 0..1, fades in and out with the source. */
  strength: number;
  last: LightSource | null;
}

export class Room implements Surroundings {
  readonly root: SVGGElement;
  readonly layers = {} as Record<RoomLayer, SVGGElement>;
  readonly props = new Map<string, Prop>();
  readonly particles: Particles;
  private readonly darkness: SVGRectElement;
  private readonly mask: SVGMaskElement;
  private readonly pools = new Map<string, LightPool>();
  private readonly world: World;
  private currentLight = 1;
  private shownDarkness: number | null = null;

  constructor(
    readonly def: SceneDef,
    container: SVGGElement,
    ctx: Omit<PropContext, "fx" | "area">,
    factories: Record<string, PropFactory>,
    backdrops: Record<string, () => SVGGElement>,
  ) {
    this.world = ctx.world;
    this.root = svgEl("g", { class: `room room-${def.id}` });
    for (const name of ["background", "wall", "shadows", "world", "effects", "lighting"] as const) {
      this.layers[name] = svgEl("g", { class: `layer layer-${name}` });
      this.root.appendChild(this.layers[name]);
    }
    container.appendChild(this.root);
    this.particles = new Particles(this.layers.effects, ctx.rng);

    const backdrop = backdrops[def.backdrop];
    if (!backdrop) throw new Error(`Unknown backdrop: ${def.backdrop}`);
    this.layers.background.appendChild(backdrop());

    const propCtx: PropContext = { ...ctx, area: def.walkArea, fx: this.particles.emit };
    for (const propDef of def.objects) {
      const factory = factories[propDef.type];
      if (!factory) throw new Error(`Unknown prop type: ${propDef.type}`);
      const prop = factory(propDef, propCtx);
      this.props.set(prop.id, prop);
      this.layers[prop.layer].appendChild(prop.root);
      if (prop.shadow) this.layers.shadows.appendChild(prop.shadow);
    }

    // Lighting: a dark tint over the room, with holes cut where lights shine.
    // Ids are per room, since every room has its own copy.
    const id = (name: string) => `${name}-${def.id}`;
    const big = { x: -BLEED, y: -BLEED, width: STAGE_WIDTH + 2 * BLEED, height: STAGE_HEIGHT + 2 * BLEED };
    const glowGradient = (gid: string, color: string) =>
      svgEl("radialGradient", { id: gid }, [
        svgEl("stop", { offset: 0, "stop-color": color, "stop-opacity": 0.55 }),
        svgEl("stop", { offset: 1, "stop-color": color, "stop-opacity": 0 }),
      ]);
    this.mask = svgEl("mask", { id: id("darkness-mask"), maskUnits: "userSpaceOnUse", ...big }, [
      svgEl("rect", { ...big, fill: "white" }),
    ]);
    const defs = svgEl("defs", {}, [
      svgEl("radialGradient", { id: id("light-hole") }, [
        svgEl("stop", { offset: 0, "stop-color": "black" }),
        svgEl("stop", { offset: 0.55, "stop-color": "#444" }),
        svgEl("stop", { offset: 1, "stop-color": "white" }),
      ]),
      glowGradient(id("light-glow-warm"), "#ffd98a"),
      glowGradient(id("light-glow-cool"), "#9fd3ff"),
      this.mask,
    ]);
    this.darkness = svgEl("rect", {
      ...big,
      fill: NIGHT_TINT,
      opacity: 0,
      mask: `url(#${id("darkness-mask")})`,
      "pointer-events": "none",
    });
    this.layers.lighting.append(defs, this.darkness);
  }

  get id(): string {
    return this.def.id;
  }

  get walkArea(): Area {
    return this.def.walkArea;
  }

  get fx(): Effects {
    return this.particles.emit;
  }

  show(visible: boolean): void {
    this.root.setAttribute("display", visible ? "inline" : "none");
  }

  /** Route a gesture on one of this room's props. Returns false if it isn't one. */
  handle(g: Gesture): boolean {
    const id = propIdOf(g.target);
    const prop = id ? this.props.get(id) : undefined;
    if (!prop) return false;
    prop.handle?.(g);
    return true;
  }

  boundsOf(target: Gesture["target"]): Bounds | null {
    const id = propIdOf(target);
    return id ? (this.props.get(id)?.bounds?.() ?? null) : null;
  }

  /** The door in this room that leads to `roomId`. */
  doorTo(roomId: string): string | null {
    for (const [id, prop] of this.props) {
      if (prop.doorTo?.() === roomId) return id;
    }
    return null;
  }

  /** `friend` is Tomatoshi's body, when it's in this room. */
  update(dt: number, friend: { root: SVGGElement; y: number } | null): void {
    for (const prop of this.props.values()) prop.update(dt);
    this.particles.update(dt);
    this.currentLight = this.computeLight();
    this.renderLighting(dt);
    this.sortDepth(friend);
  }

  // -------------------------------------------------------------------------
  // Surroundings

  light(): number {
    return this.currentLight;
  }

  opportunities(): Opportunity[] {
    const light = this.light();
    return [...this.props.values()].flatMap((p) => p.opportunities?.(light) ?? []);
  }

  spot(propId: string, action: UseAction, from: Point): Point | null {
    return this.props.get(propId)?.spot?.(action, from) ?? null;
  }

  use(propId: string, action: UseAction, from: Point): void {
    this.props.get(propId)?.use?.(action, from);
  }

  seatHeight(propId: string): number {
    return this.props.get(propId)?.seatHeight?.() ?? 0;
  }

  focus(propId: string): Point | null {
    return this.props.get(propId)?.focus?.() ?? null;
  }

  state(propId: string): Readonly<ObjectState> | null {
    return this.props.has(propId) ? this.world.get(propId) : null;
  }

  dangers(): { propId: string; danger: Danger }[] {
    const out: { propId: string; danger: Danger }[] = [];
    for (const [propId, prop] of this.props) {
      const danger = prop.danger?.();
      if (danger) out.push({ propId, danger });
    }
    return out;
  }

  // -------------------------------------------------------------------------

  private computeLight(): number {
    let light = 0;
    for (const prop of this.props.values()) light += prop.ambientLight?.() ?? 0;
    return Math.min(1, light);
  }

  private renderLighting(dt: number): void {
    // Light changes fade rather than snap.
    const target = (1 - this.currentLight) * MAX_DARKNESS;
    const ease = 1 - Math.exp(-LIGHT_EASE * dt);
    this.shownDarkness = this.shownDarkness === null ? target : this.shownDarkness + (target - this.shownDarkness) * ease;
    const darkness = this.shownDarkness;
    this.darkness.setAttribute("opacity", darkness.toFixed(3));

    for (const [id, prop] of this.props) {
      if (!prop.lightSource) continue;
      const source = prop.lightSource();
      let pool = this.pools.get(id);
      if (!pool) {
        if (!source) continue;
        pool = {
          hole: svgEl("circle", { r: 0, fill: `url(#light-hole-${this.def.id})` }),
          glow: svgEl("circle", { r: 0, opacity: 0, "pointer-events": "none" }),
          strength: 0,
          last: null,
        };
        this.mask.appendChild(pool.hole);
        this.layers.lighting.appendChild(pool.glow);
        this.pools.set(id, pool);
      }
      if (source) pool.last = source;
      pool.strength += ((source ? 1 : 0) - pool.strength) * ease;
      const s = pool.last;
      if (!s) continue;
      const r = (s.radius * pool.strength).toFixed(1);
      for (const el of [pool.hole, pool.glow]) {
        el.setAttribute("cx", s.x.toFixed(1));
        el.setAttribute("cy", s.y.toFixed(1));
        el.setAttribute("r", r);
      }
      pool.glow.setAttribute("fill", `url(#light-glow-${s.tone}-${this.def.id})`);
      // The pool reads more the darker the room is.
      pool.glow.setAttribute("opacity", ((0.35 + darkness) * pool.strength).toFixed(3));
    }
  }

  /** Things lower on screen are closer: draw them later. */
  private sortDepth(friend: { root: SVGGElement; y: number } | null): void {
    const items = [...this.props.values()]
      .filter((p) => p.layer === "world")
      .map((p) => ({ el: p.root as SVGElement, y: p.sortY() }));
    if (friend) items.push({ el: friend.root, y: friend.y });
    items.sort((a, b) => a.y - b.y);

    const layer = this.layers.world;
    const inOrder = items.length === layer.children.length && items.every((item, i) => layer.children[i] === item.el);
    if (!inOrder) for (const item of items) layer.appendChild(item.el);
  }
}

/** True if a point on the floor is inside a danger zone (an ellipse, flatter in depth). */
export function inDanger(x: number, y: number, d: Danger): boolean {
  const dx = (x - d.x) / d.radius;
  const dy = (y - d.y) / (d.radius * 0.6);
  return dx * dx + dy * dy < 1;
}
