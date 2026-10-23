// Floor areas and fake perspective: things further back (smaller y) are
// drawn smaller.

export interface Area {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function depthScale(area: Area, y: number): number {
  const t = (y - area.minY) / (area.maxY - area.minY);
  return 0.78 + Math.min(1, Math.max(0, t)) * 0.27;
}

export const clampToArea = (area: Area, x: number, y: number) => ({
  x: Math.min(area.maxX, Math.max(area.minX, x)),
  y: Math.min(area.maxY, Math.max(area.minY, y)),
});
