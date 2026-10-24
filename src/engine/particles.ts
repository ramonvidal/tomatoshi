// Small flat particles: hearts, steam, Z's, sweat, dust, crumbs, notes,
// stars and water drops. Pooled, capped, and cheap to update.

import { palette as c } from "../palette";
import { between, pick, type Rng } from "./random";
import { svgEl } from "./stage";

export type ParticleKind = "heart" | "steam" | "z" | "sweat" | "dust" | "crumb" | "note" | "star" | "drop";

/** Anything that can spawn effects (Tomatoshi, props). */
export type Effects = (kind: ParticleKind, x: number, y: number, count?: number) => void;

export interface ParticleBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Downward acceleration (negative floats up). */
  gravity: number;
  /** Velocity damping per second (exponential). */
  drag: number;
  age: number;
  life: number;
  rot: number;
  spin: number;
  scale: number;
  /** Scale change per second. */
  grow: number;
}

/** Advance one particle. Returns false once it has expired. Pure. */
export function stepParticle(p: ParticleBody, dt: number): boolean {
  p.age += dt;
  if (p.age >= p.life) return false;
  const damping = Math.exp(-p.drag * dt);
  p.vx *= damping;
  p.vy = p.vy * damping + p.gravity * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.rot += p.spin * dt;
  p.scale = Math.max(0, p.scale + p.grow * dt);
  return true;
}

/** Fade in quickly, hold, fade out over the last third. */
export function particleOpacity(p: ParticleBody): number {
  const t = p.age / p.life;
  return Math.min(1, t * 8, (1 - t) * 3);
}

const RED = "#e5484d";
const SWEAT = "#8fd0f0";
const WATER = "#5aa9e6";
const STAR = "#f2c14e";

function draw(kind: ParticleKind): SVGElement {
  switch (kind) {
    case "heart":
      return svgEl("path", { d: "M 0 9 C -13 0 -11 -11 -4 -10 C -1 -9.5 0 -7 0 -5 C 0 -7 1 -9.5 4 -10 C 11 -11 13 0 0 9 Z", fill: RED });
    case "steam":
      return svgEl("circle", { r: 10, fill: c.white, opacity: 0.85 });
    case "z":
      return svgEl("path", { d: "M -7 -7 h 14 l -14 14 h 14", stroke: c.ink, "stroke-width": 3.5, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" });
    case "sweat":
      return svgEl("path", { d: "M 0 -9 Q 7 2 0 7 Q -7 2 0 -9 Z", fill: SWEAT });
    case "dust":
      return svgEl("circle", { r: 9, fill: "#f3e3cc" });
    case "crumb":
      return svgEl("circle", { r: 4, fill: c.snack });
    case "note":
      return svgEl("g", {}, [
        svgEl("ellipse", { cx: -3, cy: 7, rx: 5, ry: 4, fill: c.ink, transform: "rotate(-20 -3 7)" }),
        svgEl("rect", { x: 1, y: -10, width: 2.5, height: 17, fill: c.ink }),
        svgEl("path", { d: "M 2 -10 Q 10 -7 8 0 Q 6 -5 2 -5 Z", fill: c.ink }),
      ]);
    case "star": {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 9 : 4;
        return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
      });
      return svgEl("polygon", { points: pts.join(" "), fill: STAR });
    }
    case "drop":
      return svgEl("path", { d: "M 0 -6 Q 5 2 0 5 Q -5 2 0 -6 Z", fill: WATER });
  }
}

/** How each kind moves. */
function spawn(kind: ParticleKind, x: number, y: number, rng: Rng): ParticleBody {
  const base: ParticleBody = {
    x, y, vx: 0, vy: 0, gravity: 0, drag: 0, age: 0, life: 1, rot: 0, spin: 0, scale: 1, grow: 0,
  };
  switch (kind) {
    case "heart":
      return { ...base, vx: between(rng, -40, 40), vy: between(rng, -120, -80), drag: 1.5, life: between(rng, 1.1, 1.5), scale: between(rng, 0.8, 1.2), spin: between(rng, -40, 40) };
    case "steam":
      return { ...base, vx: between(rng, -50, 50), vy: between(rng, -160, -110), drag: 2, life: between(rng, 0.6, 0.9), scale: 0.5, grow: 1.6 };
    case "z":
      return { ...base, vx: between(rng, 20, 40), vy: -45, gravity: -6, life: 2.2, scale: 0.7, grow: 0.45, spin: between(rng, -15, 15) };
    case "sweat":
      return { ...base, vx: pick(rng, [-1, 1]) * between(rng, 80, 150), vy: between(rng, -180, -110), gravity: 700, life: 0.7, scale: between(rng, 0.8, 1.1) };
    case "dust":
      return { ...base, vx: pick(rng, [-1, 1]) * between(rng, 60, 140), vy: between(rng, -40, -10), drag: 3.5, life: between(rng, 0.5, 0.8), scale: 0.6, grow: 1.4 };
    case "crumb":
      return { ...base, vx: between(rng, -90, 90), vy: between(rng, -170, -80), gravity: 900, life: 0.5, spin: 200 };
    case "note":
      return { ...base, vx: between(rng, -30, 30), vy: between(rng, -70, -50), life: between(rng, 1.6, 2.2), spin: between(rng, -30, 30), scale: between(rng, 0.9, 1.3) };
    case "star":
      return { ...base, vx: between(rng, -160, 160), vy: between(rng, -170, -40), drag: 3, life: 0.6, spin: between(rng, -400, 400), scale: between(rng, 0.8, 1.3) };
    case "drop":
      return { ...base, vx: between(rng, -25, 25), vy: between(rng, 40, 90), gravity: 900, life: 0.45 };
  }
}

const MAX_PARTICLES = 90;

export class Particles {
  private live: { kind: ParticleKind; body: ParticleBody; el: SVGElement }[] = [];
  private pool = new Map<ParticleKind, SVGElement[]>();

  constructor(
    private readonly layer: SVGGElement,
    private readonly rng: Rng,
  ) {}

  readonly emit: Effects = (kind, x, y, count = 1) => {
    for (let i = 0; i < count; i++) {
      if (this.live.length >= MAX_PARTICLES) this.retire(0);
      const el = this.pool.get(kind)?.pop() ?? draw(kind);
      el.setAttribute("pointer-events", "none");
      this.layer.appendChild(el);
      this.live.push({ kind, body: spawn(kind, x, y, this.rng), el });
    }
  };

  get count(): number {
    return this.live.length;
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      if (!stepParticle(p.body, dt)) {
        this.retire(i);
        continue;
      }
      const b = p.body;
      p.el.setAttribute("transform", `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${b.rot.toFixed(0)}) scale(${b.scale.toFixed(2)})`);
      p.el.setAttribute("opacity", particleOpacity(b).toFixed(2));
    }
  }

  private retire(index: number): void {
    const [p] = this.live.splice(index, 1);
    p.el.remove();
    const pool = this.pool.get(p.kind) ?? [];
    if (pool.length < 20) pool.push(p.el);
    this.pool.set(p.kind, pool);
  }
}
