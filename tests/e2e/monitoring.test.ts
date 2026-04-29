/**
 * End-to-end tests for the monitoring engine.
 * Exercises the full flow: watcher → scheduler → alert persistence → policy runner.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { WalletWatcher, ContractEventWatcher, WatcherRegistry } from "../../packages/monitor/src/watchers.ts";
import type { RpcClient, EventLog } from "../../packages/monitor/src/watchers.ts";
import { JobScheduler } from "../../packages/monitor/src/jobs.ts";
import type { MonitorJob } from "../../packages/monitor/src/jobs.ts";
import { PolicyRunner } from "../../packages/monitor/src/policy-runner.ts";
import { SqliteWorkspaceStore } from "../../packages/memory/src/sqlite-store.ts";
import { ToolRegistry } from "../../packages/agent/src/tools.ts";
import type { AlertRecord } from "../../packages/memory/src/models.ts";
import type { ApprovalPolicy } from "../../packages/agent/src/types.ts";
import {
  createMonitorEngine,
  renderMonitorStart,
  renderJobList,
  renderAlertList,
  monitorStartCommand,
  monitorListCommand,
  monitorAlertsCommand
} from "../../apps/cli/src/commands/monitor/start.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRpcClient(balanceMap: Record<string, string> = {}, logs: EventLog[] = []): RpcClient {
  return {
    async getBalance(address) { return balanceMap[address] ?? "0"; },
    async getLogs() { return logs; }
  };
}

// ---------------------------------------------------------------------------
// E2E: wallet watcher → alert saved on balance change
// ---------------------------------------------------------------------------

test("E2E: wallet balance change triggers alert that is persisted in SQLite", async () => {
  let balance = "1000000000000000000";
  const client: RpcClient = {
    async getBalance() { return balance; },
    async getLogs() { return []; }
  };

  const store = new SqliteWorkspaceStore(":memory:");
  const toolRegistry = new ToolRegistry();
  const policy: ApprovalPolicy = { requiredLevel: "read", autoApprove: true, denyHighRisk: true };
  const policyRunner = new PolicyRunner(toolRegistry, policy, store);

  const watcher = new WalletWatcher("wallet-e2e", "0x1111", "base-sepolia", client, 5);
  await watcher.check(); // baseline

  balance = "3000000000000000000"; // +200%
  const result = await watcher.check();

  assert.equal(result.triggered, true);
  if (!result.triggered) throw new Error("Expected trigger");

  const alertRecord: AlertRecord = {
    id: "e2e-alert-1",
    type: result.alert.type,
    watcherId: result.alert.watcherId,
    chainKey: result.alert.chainKey,
    address: result.alert.address,
    message: result.alert.message,
    severity: result.alert.severity,
    dataJson: JSON.stringify(result.alert.data),
    triggeredAt: new Date().toISOString()
  };

  const runResult = await policyRunner.handleAlert(alertRecord, []);
  assert.equal(runResult.denied, false);

  const saved = store.getAlert("e2e-alert-1");
  assert.ok(saved, "Alert should be persisted");
  assert.equal(saved.type, "wallet_state_change");
  assert.ok(saved.resolvedAt, "Alert should be resolved after handling");

  store.close();
});

// ---------------------------------------------------------------------------
// E2E: contract event watcher → alert saved on event detection
// ---------------------------------------------------------------------------

test("E2E: contract event detection triggers alert that is persisted in SQLite", async () => {
  const logs: EventLog[] = [
    { blockNumber: 500n, transactionHash: "0xdeadbeef", topics: ["0xtransfer"], data: "0x" }
  ];
  const client = mockRpcClient({}, logs);

  const store = new SqliteWorkspaceStore(":memory:");
  const toolRegistry = new ToolRegistry();
  const policy: ApprovalPolicy = { requiredLevel: "read", autoApprove: true, denyHighRisk: true };
  const policyRunner = new PolicyRunner(toolRegistry, policy, store);

  const watcher = new ContractEventWatcher("contract-e2e", "0xtoken", "base-sepolia", client, 0n);
  const result = await watcher.check();

  assert.equal(result.triggered, true);
  if (!result.triggered) throw new Error("Expected trigger");

  const alertRecord: AlertRecord = {
    id: "e2e-alert-2",
    type: result.alert.type,
    watcherId: result.alert.watcherId,
    chainKey: result.alert.chainKey,
    address: result.alert.address,
    message: result.alert.message,
    severity: result.alert.severity,
    dataJson: JSON.stringify(result.alert.data),
    triggeredAt: new Date().toISOString()
  };

  await policyRunner.handleAlert(alertRecord, []);

  const saved = store.getAlert("e2e-alert-2");
  assert.ok(saved);
  assert.equal(saved.type, "contract_event");
  assert.ok(saved.resolvedAt);

  store.close();
});

// ---------------------------------------------------------------------------
// E2E: scheduler drives full polling cycle
// ---------------------------------------------------------------------------

test("E2E: scheduler tick drives watcher and persists alert end-to-end", async () => {
  let balance = "1000000000000000000";
  const client: RpcClient = {
    async getBalance() { return balance; },
    async getLogs() { return []; }
  };

  const store = new SqliteWorkspaceStore(":memory:");
  const toolRegistry = new ToolRegistry();
  const policy: ApprovalPolicy = { requiredLevel: "read", autoApprove: true, denyHighRisk: true };
  const policyRunner = new PolicyRunner(toolRegistry, policy, store);
  const scheduler = new JobScheduler();

  const watcher = new WalletWatcher("sched-wallet", "0x2222", "base-sepolia", client, 5);
  await watcher.check(); // establish baseline

  balance = "5000000000000000000"; // +400%

  let alertPersisted = false;

  const job: MonitorJob = {
    id: "sched-wallet",
    type: "wallet",
    chainKey: "base-sepolia",
    address: "0x2222",
    intervalMs: 1000,
    enabled: true
  };

  scheduler.register(job, async () => {
    const result = await watcher.check();
    if (!result.triggered) return;

    const alertRecord: AlertRecord = {
      id: `sched-alert-${Date.now()}`,
      type: result.alert.type,
      watcherId: result.alert.watcherId,
      chainKey: result.alert.chainKey,
      address: result.alert.address,
      message: result.alert.message,
      severity: result.alert.severity,
      dataJson: JSON.stringify(result.alert.data),
      triggeredAt: new Date().toISOString()
    };

    await policyRunner.handleAlert(alertRecord, []);
    alertPersisted = true;
  });

  await scheduler.tick(Date.now() + 50);

  assert.equal(alertPersisted, true);

  const all = store.listAlerts({ resolved: true });
  assert.ok(all.length > 0);

  store.close();
});

// ---------------------------------------------------------------------------
// E2E: policy runner blocks high-risk follow-up actions
// ---------------------------------------------------------------------------

test("E2E: bounded follow-up action under policy — high-risk denied", async () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const toolRegistry = new ToolRegistry();
  let drainCalled = false;
  toolRegistry.register({
    name: "drain_balance",
    description: "HIGH RISK drain",
    approvalLevel: "broadcast",
    isHighRisk: true,
    execute: async () => { drainCalled = true; return {}; }
  });

  const policy: ApprovalPolicy = { requiredLevel: "read", autoApprove: true, denyHighRisk: true };
  const policyRunner = new PolicyRunner(toolRegistry, policy, store);

  const alert: AlertRecord = {
    id: "e2e-highrisk-1",
    type: "wallet_state_change",
    watcherId: "w-hr",
    chainKey: "base-sepolia",
    address: "0x3333",
    message: "Balance dropped",
    severity: "critical",
    dataJson: "{}",
    triggeredAt: new Date().toISOString()
  };

  const result = await policyRunner.handleAlert(alert, [{ tool: "drain_balance", args: {} }]);

  assert.equal(result.denied, true);
  assert.equal(drainCalled, false);
  store.close();
});

// ---------------------------------------------------------------------------
// E2E: bounded follow-up action under policy — safe action approved
// ---------------------------------------------------------------------------

test("E2E: bounded follow-up action under policy — safe action executes", async () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const toolRegistry = new ToolRegistry();
  let balanceCalled = false;
  toolRegistry.register({
    name: "balance",
    description: "Get balance",
    approvalLevel: "read",
    isHighRisk: false,
    execute: async () => { balanceCalled = true; return { balance: "0" }; }
  });

  const policy: ApprovalPolicy = { requiredLevel: "read", autoApprove: true, denyHighRisk: true };
  const policyRunner = new PolicyRunner(toolRegistry, policy, store);

  const alert: AlertRecord = {
    id: "e2e-safe-1",
    type: "wallet_state_change",
    watcherId: "w-safe",
    chainKey: "base-sepolia",
    address: "0x4444",
    message: "Balance changed",
    severity: "info",
    dataJson: "{}",
    triggeredAt: new Date().toISOString()
  };

  const result = await policyRunner.handleAlert(alert, [{ tool: "balance", args: { address: "0x4444", chain: "base-sepolia" } }]);

  assert.equal(result.denied, false);
  assert.equal(result.actionsCompleted, 1);
  assert.equal(balanceCalled, true);
  store.close();
});

// ---------------------------------------------------------------------------
// E2E: CLI command renderers
// ---------------------------------------------------------------------------

test("E2E: monitorStartCommand returns startup message", async () => {
  const msg = await monitorStartCommand({ tickMs: 5000 });
  assert(msg.includes("ChainMind Monitor"));
  assert(msg.includes("5000ms"));
});

test("E2E: monitorListCommand renders job list", () => {
  const scheduler = new JobScheduler();
  const job: MonitorJob = { id: "j1", type: "wallet", chainKey: "base-sepolia", address: "0x1", intervalMs: 10000, enabled: true };
  scheduler.register(job, async () => {});

  const output = monitorListCommand(scheduler);
  assert(output.includes("j1"));
  assert(output.includes("wallet"));
  assert(output.includes("base-sepolia"));
});

test("E2E: monitorListCommand renders empty message when no jobs", () => {
  const scheduler = new JobScheduler();
  const output = monitorListCommand(scheduler);
  assert(output.includes("No monitoring jobs"));
});

test("E2E: monitorAlertsCommand renders alert list", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  store.saveAlert({
    id: "render-test-1",
    type: "wallet_state_change",
    watcherId: "w1",
    chainKey: "base-sepolia",
    address: "0x1",
    message: "Balance changed",
    severity: "info",
    dataJson: "{}",
    triggeredAt: new Date().toISOString()
  });

  const output = monitorAlertsCommand(store);
  assert(output.includes("render-test-1"));
  assert(output.includes("wallet_state_change"));
  assert(output.includes("[open]"));
  store.close();
});

test("E2E: monitorAlertsCommand renders empty message when no alerts", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const output = monitorAlertsCommand(store);
  assert(output.includes("No alerts"));
  store.close();
});

// ---------------------------------------------------------------------------
// E2E: createMonitorEngine wires components together
// ---------------------------------------------------------------------------

test("E2E: createMonitorEngine returns connected scheduler and store", () => {
  const { scheduler, store, registry } = createMonitorEngine({ tickMs: 5000, databasePath: ":memory:" });

  assert.ok(scheduler);
  assert.ok(store);
  assert.ok(registry);
  assert.equal(scheduler.list().length, 0);

  store.close();
});

test("E2E: WatcherRegistry checkAll aggregates results from multiple watchers", async () => {
  let balance = "1000";
  const client: RpcClient = {
    async getBalance() { return balance; },
    async getLogs() { return []; }
  };

  const registry = new WatcherRegistry();
  const w1 = new WalletWatcher("wA", "0xA", "base-sepolia", client);
  const w2 = new WalletWatcher("wB", "0xB", "base-sepolia", client);
  registry.register(w1);
  registry.register(w2);

  // First check: both baseline (no trigger)
  const first = await registry.checkAll();
  assert.equal(first.every((r) => !r.result.triggered), true);

  balance = "5000"; // large jump
  // Second check: both should trigger
  const second = await registry.checkAll();
  assert.equal(second.every((r) => r.result.triggered), true);
});
