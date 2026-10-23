// A room built from a scene definition: backdrop, props, lighting and
// depth sorting. Also what Tomatoshi sees of its surroundings.

import type { Area } from "./area";
import type { Gesture } from "./input";
import { propIdOf } from "./input";
import { svgEl, STAGE_HEIGHT, STAGE_WIDTH, type Stage } from "./stage";
import type { Opportunity, Point, Prop, PropContext, PropDef, PropFactory, UseAction } from "../objects/prop";

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
}

/** Darkness overlay color and how dark "no light at all" gets. */
const NIGHT_TINT = "#141a3a";
const MAX_DARKNESS = 0.7;
const BLEED = 1200;

export class Room implements Surroundings {
  readonly props = new Map<string, Prop>();
  private readonly darkness: SVGRectElement;
  private readonly glow: SVGCircleElement;
  private readonly hole: SVGCircleElement;
  private currentLight = 1;

  constructor(
    readonly def: SceneDef,
    private readonly stage: Stage,
    ctx: PropContext,
    factories: Record<string, PropFactory>,
    backdrops: Record<string, () => SVGGElement>,
  ) {
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

    // Lighting: a dark tint over the room, with holes cut where lamps shine.
    const big = { x: -BLEED, y: -BLEED, width: STAGE_WIDTH + 2 * BLEED, height: STAGE_HEIGHT + 2 * BLEED };
    this.hole = svgEl("circle", { r: 0, fill: "url(#light-hole)" });
    this.glow = svgEl("circle", { r: 0, fill: "url(#light-glow)", opacity: 0 });
    const defs = svgEl("defs", {}, [
      svgEl("radialGradient", { id: "light-hole" }, [
        svgEl("stop", { offset: 0, "stop-color": "black" }),
        svgEl("stop", { offset: 0.55, "stop-color": "#444" }),
        svgEl("stop", { offset: 1, "stop-color": "white" }),
      ]),
      svgEl("radialGradient", { id: "light-glow" }, [
        svgEl("stop", { offset: 0, "stop-color": "#ffd98a", "stop-opacity": 0.55 }),
        svgEl("stop", { offset: 1, "stop-color": "#ffd98a", "stop-opacity": 0 }),
      ]),
      svgEl("mask", { id: "darkness-mask", maskUnits: "userSpaceOnUse", ...big }, [
        svgEl("rect", { ...big, fill: "white" }),
        this.hole,
      ]),
    ]);
    this.darkness = svgEl("rect", { ...big, fill: NIGHT_TINT, opacity: 0, mask: "url(#darkness-mask)", "pointer-events": "none" });
    this.glow.setAttribute("pointer-events", "none");
    stage.layers.lighting.append(defs, this.darkness, this.glow);
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
    this.renderLighting();
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

  // -------------------------------------------------------------------------

  private computeLight(): number {
    let light = 0;
    for (const prop of this.props.values()) light += prop.ambientLight?.() ?? 0;
    return Math.min(1, light);
  }

  private renderLighting(): void {
    const darkness = (1 - this.currentLight) * MAX_DARKNESS;
    this.darkness.setAttribute("opacity", darkness.toFixed(3));

    const source = [...this.props.values()].map((p) => p.lightSource?.()).find((s) => s);
    if (source) {
      for (const el of [this.hole, this.glow]) {
        el.setAttribute("cx", source.x.toFixed(1));
        el.setAttribute("cy", source.y.toFixed(1));
        el.setAttribute("r", source.radius.toFixed(1));
      }
      // The warm pool reads more the darker the room is.
      this.glow.setAttribute("opacity", (0.35 + darkness).toFixed(3));
    } else {
      this.hole.setAttribute("r", "0");
      this.glow.setAttribute("opacity", "0");
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
