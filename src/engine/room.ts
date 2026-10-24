// A room built from a scene definition: backdrop, props, lighting and
// depth sorting. Also what Tomatoshi sees of its surroundings.

import type { Area } from "./area";
import type { Gesture } from "./input";
import { propIdOf } from "./input";
import { svgEl, STAGE_HEIGHT, STAGE_WIDTH, type Stage } from "./stage";
import type { LightSource, Opportunity, Point, Prop, PropContext, PropDef, PropFactory, UseAction } from "../objects/prop";
import type { ObjectState, World } from "./world";

/** A doorway to another room. Used from M5. */
export interface ExitDef {
  to: string;
  x: number;
  y: number;
  /** Puzzle hook: a world condition that must hold, e.g. "fridge.open". */
  requires?: string;
}

/** Puzzle hook (not interpreted yet): when the conditions hold, do the actions. */
export interface TriggerDef {
  when: string[];
  then: string[];
}

/** A room as data. */
export interface SceneDef {
  id: string;
  backdrop: string;
  walkArea: Area;
  /** Where Tomatoshi starts. */
  start: Point;
  objects: PropDef[];
  exits: ExitDef[];
  triggers: TriggerDef[];
}

/** What Tomatoshi can ask about the room it's in. */
export interface Surroundings {
  /** Overall light, 0 (pitch dark) .. 1. */
  light(): number;
  opportunities(): Opportunity[];
  spot(propId: string, action: UseAction, from: Point): Point | null;
  use(propId: string, action: UseAction, from: Point): void;
  seatHeight(propId: string): number;
  focus(propId: string): Point | null;
  /** An object's current state (e.g. the TV's channel). */
  state(propId: string): Readonly<ObjectState> | null;
}

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
  readonly props = new Map<string, Prop>();
  private readonly darkness: SVGRectElement;
  private readonly mask: SVGMaskElement;
  private readonly pools = new Map<string, LightPool>();
  private readonly world: World;
  private currentLight = 1;
  private shownDarkness: number | null = null;

  constructor(
    readonly def: SceneDef,
    private readonly stage: Stage,
    ctx: PropContext,
    factories: Record<string, PropFactory>,
    backdrops: Record<string, () => SVGGElement>,
  ) {
    this.world = ctx.world;
    const backdrop = backdrops[def.backdrop];
    if (!backdrop) throw new Error(`Unknown backdrop: ${def.backdrop}`);
    stage.layers.background.appendChild(backdrop());

    for (const propDef of def.objects) {
      const factory = factories[propDef.type];
      if (!factory) throw new Error(`Unknown prop type: ${propDef.type}`);
      const prop = factory(propDef, ctx);
      this.props.set(prop.id, prop);
      stage.layers[prop.layer].appendChild(prop.root);
      if (prop.shadow) stage.layers.shadows.appendChild(prop.shadow);
    }

    // Lighting: a dark tint over the room, with holes cut where lights shine.
    const big = { x: -BLEED, y: -BLEED, width: STAGE_WIDTH + 2 * BLEED, height: STAGE_HEIGHT + 2 * BLEED };
    const glowGradient = (id: string, color: string) =>
      svgEl("radialGradient", { id }, [
        svgEl("stop", { offset: 0, "stop-color": color, "stop-opacity": 0.55 }),
        svgEl("stop", { offset: 1, "stop-color": color, "stop-opacity": 0 }),
      ]);
    this.mask = svgEl("mask", { id: "darkness-mask", maskUnits: "userSpaceOnUse", ...big }, [
      svgEl("rect", { ...big, fill: "white" }),
    ]);
    const defs = svgEl("defs", {}, [
      svgEl("radialGradient", { id: "light-hole" }, [
        svgEl("stop", { offset: 0, "stop-color": "black" }),
        svgEl("stop", { offset: 0.55, "stop-color": "#444" }),
        svgEl("stop", { offset: 1, "stop-color": "white" }),
      ]),
      glowGradient("light-glow-warm", "#ffd98a"),
      glowGradient("light-glow-cool", "#9fd3ff"),
      this.mask,
    ]);
    this.darkness = svgEl("rect", { ...big, fill: NIGHT_TINT, opacity: 0, mask: "url(#darkness-mask)", "pointer-events": "none" });
    stage.layers.lighting.append(defs, this.darkness);
  }

  get walkArea(): Area {
    return this.def.walkArea;
  }

  /** Route a gesture on a prop. Returns false if it wasn't for a prop. */
  handle(g: Gesture): boolean {
    const id = propIdOf(g.target);
    if (!id) return false;
    this.props.get(id)?.handle?.(g);
    return true;
  }

  boundsOf(target: Gesture["target"]) {
    const id = propIdOf(target);
    return id ? (this.props.get(id)?.bounds?.() ?? null) : null;
  }

  update(dt: number, friend: { root: SVGGElement; y: number }): void {
    for (const prop of this.props.values()) prop.update(dt);
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
          hole: svgEl("circle", { r: 0, fill: "url(#light-hole)" }),
          glow: svgEl("circle", { r: 0, opacity: 0, "pointer-events": "none" }),
          strength: 0,
          last: null,
        };
        this.mask.appendChild(pool.hole);
        this.stage.layers.lighting.appendChild(pool.glow);
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
      pool.glow.setAttribute("fill", `url(#light-glow-${s.tone})`);
      // The pool reads more the darker the room is.
      pool.glow.setAttribute("opacity", ((0.35 + darkness) * pool.strength).toFixed(3));
    }
  }

  /** Things lower on screen are closer: draw them later. */
  private sortDepth(friend: { root: SVGGElement; y: number }): void {
    const items = [...this.props.values()]
      .filter((p) => p.layer === "world")
      .map((p) => ({ el: p.root as SVGElement, y: p.sortY() }));
    items.push({ el: friend.root, y: friend.y });
    items.sort((a, b) => a.y - b.y);

    const layer = this.stage.layers.world;
    const inOrder = items.every((item, i) => layer.children[i] === item.el);
    if (!inOrder) for (const item of items) layer.appendChild(item.el);
  }
}
