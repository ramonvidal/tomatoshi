// The 9:16 portrait stage. All game coordinates live in a fixed
// STAGE_WIDTH x STAGE_HEIGHT space; the SVG viewBox scales it to the screen.
// Content outside that space stays visible, so scenes can bleed their
// backgrounds into the extra area on taller or wider screens.

export const STAGE_WIDTH = 720;
export const STAGE_HEIGHT = 1280;

export const SVG_NS = "http://www.w3.org/2000/svg";

/** Rooms (each with its own layers, see Room), then speech bubbles and fades on top. */
export type LayerName = "rooms" | "ui";

export interface Stage {
  svg: SVGSVGElement;
  layers: Record<LayerName, SVGGElement>;
  /** Screen pixels per stage unit. */
  scale(): number;
  /** Convert a client (screen) point to stage coordinates. */
  toStage(clientX: number, clientY: number): { x: number; y: number };
}

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  children: SVGElement[] = [],
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  for (const child of children) el.appendChild(child);
  return el;
}

export function createStage(container: HTMLElement): Stage {
  const svg = svgEl("svg", {
    viewBox: `0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`,
    preserveAspectRatio: "xMidYMid meet",
    class: "stage",
    role: "img",
    "aria-label": "Tomatoshi's room",
  });

  const root = svgEl("g");
  svg.appendChild(root);

  const layers = {} as Record<LayerName, SVGGElement>;
  for (const name of ["rooms", "ui"] as const) {
    layers[name] = svgEl("g", { class: `layer layer-${name}` });
    root.appendChild(layers[name]);
  }

  container.appendChild(svg);

  return {
    svg,
    layers,
    scale() {
      const rect = svg.getBoundingClientRect();
      return Math.min(rect.width / STAGE_WIDTH, rect.height / STAGE_HEIGHT);
    },
    toStage(clientX, clientY) {
      const matrix = svg.getScreenCTM();
      if (!matrix) return { x: 0, y: 0 };
      const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
      return { x: p.x, y: p.y };
    },
  };
}
