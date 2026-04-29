/**
 * Job scheduler for periodic monitoring tasks.
 * The scheduler is decoupled from real time: tick() is callable manually in tests.
 */

export interface MonitorJob {
  id: string;
  type: "wallet" | "contract";
  chainKey: string;
  address: string;
  intervalMs: number;
  enabled: boolean;
  lastRunAt?: string;
}

export type JobHandler = (job: MonitorJob) => Promise<void>;

interface JobEntry {
  job: MonitorJob;
  handler: JobHandler;
  nextRunAt: number;
}

/**
 * Schedules and ticks monitoring jobs.
 * A job fires when now >= nextRunAt.
 */
export class JobScheduler {
  private jobs: Map<string, JobEntry> = new Map();
  private timer: ReturnType<typeof setInterval> | null = null;

  register(job: MonitorJob, handler: JobHandler): void {
    this.jobs.set(job.id, { job, handler, nextRunAt: Date.now() });
  }

  cancel(jobId: string): boolean {
    return this.jobs.delete(jobId);
  }

  enable(jobId: string): void {
    const entry = this.jobs.get(jobId);
    if (entry) entry.job.enabled = true;
  }

  disable(jobId: string): void {
    const entry = this.jobs.get(jobId);
    if (entry) entry.job.enabled = false;
  }

  list(): MonitorJob[] {
    return Array.from(this.jobs.values()).map(({ job }) => ({ ...job }));
  }

  /**
   * Run all jobs whose nextRunAt <= now.
   * Handler errors are caught and swallowed so one bad job cannot stall others.
   */
  async tick(now = Date.now()): Promise<void> {
    for (const entry of this.jobs.values()) {
      if (!entry.job.enabled) continue;
      if (now < entry.nextRunAt) continue;

      entry.job.lastRunAt = new Date(now).toISOString();
      entry.nextRunAt = now + entry.job.intervalMs;

      try {
        await entry.handler(entry.job);
      } catch {
        // swallow — caller can observe via side effects (alerts persisted, logs)
      }
    }
  }

  /**
   * Start an automatic real-time tick loop.
   * Safe to call multiple times; only one loop runs.
   */
  start(tickIntervalMs = 1000): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, tickIntervalMs);
  }

  /** Stop the automatic tick loop. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }
}
