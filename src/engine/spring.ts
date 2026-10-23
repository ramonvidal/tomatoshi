// Damped spring for wobbles and squashes. Sub-stepped so it stays stable
// even when a frame takes long.

export class Spring {
  value = 0;
  velocity = 0;

  constructor(
    private readonly stiffness: number,
    private readonly damping: number,
    public target = 0,
  ) {}

  kick(velocity: number): void {
    this.velocity += velocity;
  }

  update(dt: number): number {
    const steps = Math.ceil(dt / (1 / 120));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.velocity += (this.stiffness * (this.target - this.value) - this.damping * this.velocity) * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}
