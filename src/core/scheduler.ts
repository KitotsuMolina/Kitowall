// Rotation scheduler stub for future use.
export interface SchedulerOptions {
  intervalSeconds: number;
  onTick: () => Promise<void> | void;
}

export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private readonly onTick: () => Promise<void> | void;

  constructor(options: SchedulerOptions) {
    this.intervalMs = Math.max(options.intervalSeconds, 1) * 1000;
    this.onTick = options.onTick;
  }

  start(): void {
    if (this.timer)
      return;

    this.timer = setInterval(() => {
      void this.onTick();
    }, this.intervalMs);
  }

  stop(): void {
    if (!this.timer)
      return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
