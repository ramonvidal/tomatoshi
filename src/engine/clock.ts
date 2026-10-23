// Time of day, from the real clock. `?hour=21.5` in the URL overrides it,
// which makes night easy to test during the day.

export function hourOverride(search: string): number | null {
  const raw = new URLSearchParams(search).get("hour");
  if (raw === null || raw.trim() === "") return null;
  const hour = Number(raw);
  return Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : null;
}

export function createClock(search = typeof location === "undefined" ? "" : location.search): () => number {
  const fixed = hourOverride(search);
  if (fixed !== null) return () => fixed;
  return () => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  };
}

export interface Sky {
  /** 0 = night, 1 = full day. */
  daylight: number;
  color: string;
  /** 0..1 */
  stars: number;
  body: "sun" | "moon";
}

const SKY = {
  day: [191, 227, 242],
  dusk: [246, 179, 138],
  night: [45, 58, 92],
} as const;

const rgb = (c: readonly number[]) => `rgb(${c.join(", ")})`;

const mix = (a: readonly number[], b: readonly number[], t: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(", ")})`;

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Daylight: night until 5:30, sunrise until 7:30, day until 18:30, sunset until 20:30. */
export function skyAt(hour: number): Sky {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 7.5 && h < 18.5) return { daylight: 1, color: rgb(SKY.day), stars: 0, body: "sun" };
  if (h >= 20.5 || h < 5.5) return { daylight: 0, color: rgb(SKY.night), stars: 1, body: "moon" };

  // Twilight: night → dusk → day (morning) or day → dusk → night (evening).
  const morning = h < 12;
  const t = morning ? (h - 5.5) / 2 : 1 - (h - 18.5) / 2; // 0 = night, 1 = day
  const daylight = smooth(t);
  const color = t < 0.5 ? mix(SKY.night, SKY.dusk, t * 2) : mix(SKY.dusk, SKY.day, (t - 0.5) * 2);
  return { daylight, color, stars: Math.max(0, 1 - t * 2.5), body: t > 0.4 ? "sun" : "moon" };
}
