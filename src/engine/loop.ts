// Variable-step game loop on top of requestAnimationFrame.
// Clock and frame scheduler are injectable so the loop is testable.

export type TickFn = (dt: number, time: number) => void;

export interface LoopDeps {
  now: () => number;
  requestFrame: (cb: () => void) => number;
  cancelFrame: (id: number) => void;
}

/** Longest step we simulate in one tick, in seconds (e.g. after a background tab). */
export const MAX_DT = 0.1;

const browserDeps = (): LoopDeps => ({
  now: () => performance.now(),
  requestFrame: (cb) => requestAnimationFrame(cb),
  cancelFrame: (id) => cancelAnimationFrame(id),
});

export class Loop {
  private frameId: number | null = null;
  private last = 0;
  private elapsed = 0;

  constructor(
    private readonly tick: TickFn,
    private readonly deps: LoopDeps = browserDeps(),
  ) {}

  get running(): boolean {
    return this.frameId !== null;
  }

  start(): void {
    if (this.running) return;
    this.last = this.deps.now();
    this.frameId = this.deps.requestFrame(this.frame);
  }

  stop(): void {
    if (this.frameId !== null) this.deps.cancelFrame(this.frameId);
    this.frameId = null;
  }

  private frame = (): void => {
    const now = this.deps.now();
    const dt = Math.min((now - this.last) / 1000, MAX_DT);
    this.last = now;
    this.elapsed += dt;
    this.tick(dt, this.elapsed);
    if (this.running) this.frameId = this.deps.requestFrame(this.frame);
  };
}
