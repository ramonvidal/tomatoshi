// `?debug` in the URL shows Tomatoshi's needs and mood, for tuning.

import type { Tomatoshi } from "./friend/Tomatoshi";
import { NEED_NAMES } from "./friend/needs";

export function attachDebugPanel(friend: Tomatoshi, light: () => number): void {
  const panel = document.createElement("pre");
  Object.assign(panel.style, {
    position: "fixed",
    top: "8px",
    left: "8px",
    margin: "0",
    padding: "6px 8px",
    font: "12px/1.4 ui-monospace, monospace",
    color: "#fffaf3",
    background: "rgba(46, 38, 38, 0.75)",
    borderRadius: "6px",
    pointerEvents: "none",
    zIndex: "10",
  });
  document.body.appendChild(panel);

  const bar = (v: number) => "█".repeat(Math.round(v / 10)).padEnd(10, "·");
  setInterval(() => {
    const needs = friend.currentNeeds;
    panel.textContent = [
      ...NEED_NAMES.map((n) => `${n.padEnd(9)} ${bar(needs[n])} ${needs[n].toFixed(0).padStart(3)}`),
      `mood      ${friend.mood}`,
      `light     ${light().toFixed(2)}`,
    ].join("\n");
  }, 250);
}
