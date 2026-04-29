/**
 * chainmind monitor start   — start the polling monitor daemon
 * chainmind monitor list    — list registered watcher jobs
 * chainmind monitor alerts  — list persisted alerts
 *
 * In the current bootstrap the scheduler ticks in-process.
 * A production version would fork to a daemon or use an OS service.
 */

import { JobScheduler } from "../../../../../packages/monitor/src/jobs.ts";
import type { MonitorJob } from "../../../../../packages/monitor/src/jobs.ts";
import { WatcherRegistry, WalletWatcher, ContractEventWatcher } from "../../../../../packages/monitor/src/watchers.ts";
import { PolicyRunner } from "../../../../../packages/monitor/src/policy-runner.ts";
import { SqliteWorkspaceStore } from "../../../../../packages/memory/src/sqlite-store.ts";
import { createDefaultToolRegistry } from "../../../../../packages/agent/src/tools.ts";
import type { ApprovalPolicy } from "../../../../../packages/agent/src/types.ts";
import type { AlertRecord } from "../../../../../packages/memory/src/models.ts";

export interface MonitorStartOptions {
  tickMs?: number;
  databasePath?: string;
}

export interface MonitorListOptions {
  scheduler: JobScheduler;
}

export interface MonitorAlertsOptions {
  store: SqliteWorkspaceStore;
  resolved?: boolean;
  watcherId?: string;
}

/**
 * Render the monitor start banner.
 */
export function renderMonitorStart(tickMs: number): string {
  return [
    "ChainMind Monitor",
    `Tick interval: ${tickMs}ms`,
    "Watching for wallet and contract events...",
    "Press Ctrl+C to stop."
  ].join("\n");
}

/**
 * Render the list of active monitoring jobs.
 */
export function renderJobList(jobs: MonitorJob[]): string {
  if (jobs.length === 0) return "No monitoring jobs registered.";
  const lines = jobs.map((j) => {
    const lastRun = j.lastRunAt ? ` (last: ${j.lastRunAt})` : "";
    const state = j.enabled ? "enabled" : "disabled";
    return `- [${state}] ${j.id}  ${j.type}  ${j.address}  @${j.chainKey}  every ${j.intervalMs}ms${lastRun}`;
  });
  return ["Active monitoring jobs:", ...lines].join("\n");
}

/**
 * Render the list of persisted alerts.
 */
export function renderAlertList(alerts: AlertRecord[]): string {
  if (alerts.length === 0) return "No alerts found.";
  const lines = alerts.map((a) => {
    const resolved = a.resolvedAt ? ` [resolved ${a.resolvedAt}]` : " [open]";
    return `- [${a.severity}] ${a.id}  ${a.type}  ${a.message}${resolved}`;
  });
  return ["Alerts:", ...lines].join("\n");
}

/**
 * Build a default monitoring engine wired to an in-process SQLite store.
 * Returns everything needed to start watching.
 */
export function createMonitorEngine(options: MonitorStartOptions = {}) {
  const { tickMs = 30_000, databasePath = ":memory:" } = options;

  const store = new SqliteWorkspaceStore(databasePath);
  const scheduler = new JobScheduler();
  const registry = new WatcherRegistry();
  const toolRegistry = createDefaultToolRegistry();

  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  const policyRunner = new PolicyRunner(toolRegistry, policy, store);

  /**
   * Attach a wallet watcher and wire it into the scheduler.
   */
  function watchWallet(watcherId: string, address: string, chainKey: string, rpcClient: import("../../../../../packages/monitor/src/watchers.ts").RpcClient): void {
    const watcher = new WalletWatcher(watcherId, address, chainKey, rpcClient);
    registry.register(watcher);

    const job: MonitorJob = {
      id: watcherId,
      type: "wallet",
      chainKey,
      address,
      intervalMs: tickMs,
      enabled: true
    };

    scheduler.register(job, async () => {
      const result = await watcher.check();
      if (!result.triggered) return;

      const alert: AlertRecord = {
        id: `${watcherId}-${Date.now()}`,
        type: result.alert.type,
        watcherId: result.alert.watcherId,
        chainKey: result.alert.chainKey,
        address: result.alert.address,
        message: result.alert.message,
        severity: result.alert.severity,
        dataJson: JSON.stringify(result.alert.data),
        triggeredAt: new Date().toISOString()
      };

      await policyRunner.handleAlert(alert, []);
    });
  }

  /**
   * Attach a contract event watcher and wire it into the scheduler.
   */
  function watchContract(watcherId: string, address: string, chainKey: string, rpcClient: import("../../../../../packages/monitor/src/watchers.ts").RpcClient, fromBlock = 0n): void {
    const watcher = new ContractEventWatcher(watcherId, address, chainKey, rpcClient, fromBlock);
    registry.register(watcher);

    const job: MonitorJob = {
      id: watcherId,
      type: "contract",
      chainKey,
      address,
      intervalMs: tickMs,
      enabled: true
    };

    scheduler.register(job, async () => {
      const result = await watcher.check();
      if (!result.triggered) return;

      const alert: AlertRecord = {
        id: `${watcherId}-${Date.now()}`,
        type: result.alert.type,
        watcherId: result.alert.watcherId,
        chainKey: result.alert.chainKey,
        address: result.alert.address,
        message: result.alert.message,
        severity: result.alert.severity,
        dataJson: JSON.stringify(result.alert.data),
        triggeredAt: new Date().toISOString()
      };

      await policyRunner.handleAlert(alert, []);
    });
  }

  return { scheduler, registry, store, policyRunner, watchWallet, watchContract };
}

/**
 * Start monitoring command handler.
 * Returns the startup message; caller decides whether to block.
 */
export async function monitorStartCommand(options: MonitorStartOptions = {}): Promise<string> {
  const { tickMs = 30_000 } = options;
  return renderMonitorStart(tickMs);
}

/**
 * List jobs command handler.
 */
export function monitorListCommand(scheduler: JobScheduler): string {
  return renderJobList(scheduler.list());
}

/**
 * List alerts command handler.
 */
export function monitorAlertsCommand(store: SqliteWorkspaceStore, filter?: { resolved?: boolean; watcherId?: string }): string {
  return renderAlertList(store.listAlerts(filter));
}
