import test from "node:test";
import assert from "node:assert/strict";

import { WalletWatcher, ContractEventWatcher, WatcherRegistry } from "./watchers.ts";
import type { RpcClient, EventLog } from "./watchers.ts";
import { JobScheduler } from "./jobs.ts";
import type { MonitorJob } from "./jobs.ts";
import { PolicyRunner } from "./policy-runner.ts";
import { SqliteWorkspaceStore } from "../../memory/src/sqlite-store.ts";
import { ToolRegistry } from "../../agent/src/tools.ts";
import type { ApprovalPolicy } from "../../agent/src/types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRpcClient(
  balances: Record<string, string> = {},
  logs: EventLog[] = []
): RpcClient {
  return {
    async getBalance(address, _chainKey) {
      return balances[address] ?? "0";
    },
    async getLogs(_address, _chainKey, _fromBlock) {
      return logs;
    }
  };
}

function makeAlertRecord(override: Partial<Parameters<SqliteWorkspaceStore["saveAlert"]>[0]> = {}) {
  return {
    id: "alert-1",
    type: "wallet_state_change" as const,
    watcherId: "w1",
    chainKey: "base-sepolia",
    address: "0x1234",
    message: "Balance changed",
    severity: "info" as const,
    dataJson: JSON.stringify({}),
    triggeredAt: new Date().toISOString(),
    ...override
  };
}

// ---------------------------------------------------------------------------
// WalletWatcher tests
// ---------------------------------------------------------------------------

test("WalletWatcher: first check records baseline and does not trigger", async () => {
  const client = makeRpcClient({ "0xabc": "1000000000000000000" });
  const watcher = new WalletWatcher("w1", "0xabc", "base-sepolia", client);

  const result = await watcher.check();
  assert.equal(result.triggered, false);
});

test("WalletWatcher: no trigger when balance unchanged", async () => {
  const client = makeRpcClient({ "0xabc": "1000000000000000000" });
  const watcher = new WalletWatcher("w1", "0xabc", "base-sepolia", client);

  await watcher.check(); // baseline
  const result = await watcher.check();
  assert.equal(result.triggered, false);
});

test("WalletWatcher: triggers when balance changes beyond threshold", async () => {
  let balance = "1000000000000000000";
  const client: RpcClient = {
    async getBalance() { return balance; },
    async getLogs() { return []; }
  };
  const watcher = new WalletWatcher("w1", "0xabc", "base-sepolia", client, 5);

  await watcher.check(); // baseline = 1e18
  balance = "2000000000000000000"; // +100%, exceeds 5% threshold
  const result = await watcher.check();

  assert.equal(result.triggered, true);
  if (result.triggered) {
    assert.equal(result.alert.type, "wallet_state_change");
    assert.equal(result.alert.watcherId, "w1");
    assert.equal(result.alert.chainKey, "base-sepolia");
    assert(result.alert.message.includes("increased"));
  }
});

test("WalletWatcher: does not trigger when change is below threshold", async () => {
  let balance = "1000000000000000000";
  const client: RpcClient = {
    async getBalance() { return balance; },
    async getLogs() { return []; }
  };
  const watcher = new WalletWatcher("w1", "0xabc", "base-sepolia", client, 20);

  await watcher.check(); // baseline = 1e18
  balance = "1010000000000000000"; // +1%, below 20% threshold
  const result = await watcher.check();
  assert.equal(result.triggered, false);
});

test("WalletWatcher: triggers when balance drops from non-zero to changed", async () => {
  let balance = "1000000000000000000";
  const client: RpcClient = {
    async getBalance() { return balance; },
    async getLogs() { return []; }
  };
  const watcher = new WalletWatcher("w1", "0xabc", "eth-mainnet", client, 5);

  await watcher.check(); // baseline
  balance = "500000000000000000"; // -50%
  const result = await watcher.check();

  assert.equal(result.triggered, true);
  if (result.triggered) {
    assert(result.alert.message.includes("decreased"));
  }
});

test("WalletWatcher: resetBaseline causes next check to re-baseline", async () => {
  let balance = "1000000000000000000";
  const client: RpcClient = {
    async getBalance() { return balance; },
    async getLogs() { return []; }
  };
  const watcher = new WalletWatcher("w1", "0xabc", "base-sepolia", client, 5);

  await watcher.check(); // baseline
  balance = "2000000000000000000";
  watcher.resetBaseline();

  const result = await watcher.check(); // should baseline again, not trigger
  assert.equal(result.triggered, false);
});

// ---------------------------------------------------------------------------
// ContractEventWatcher tests
// ---------------------------------------------------------------------------

test("ContractEventWatcher: no trigger when no logs returned", async () => {
  const client = makeRpcClient({}, []);
  const watcher = new ContractEventWatcher("w2", "0xcontract", "base-sepolia", client, 0n);

  const result = await watcher.check();
  assert.equal(result.triggered, false);
});

test("ContractEventWatcher: triggers when logs are returned", async () => {
  const logs: EventLog[] = [
    { blockNumber: 100n, transactionHash: "0xaaa", topics: ["0xtopic1"], data: "0x" }
  ];
  const client = makeRpcClient({}, logs);
  const watcher = new ContractEventWatcher("w2", "0xcontract", "base-sepolia", client, 0n);

  const result = await watcher.check();
  assert.equal(result.triggered, true);
  if (result.triggered) {
    assert.equal(result.alert.type, "contract_event");
    assert.equal(result.alert.watcherId, "w2");
    assert(result.alert.message.includes("1 event(s)"));
  }
});

test("ContractEventWatcher: advances fromBlock cursor after trigger", async () => {
  const logs: EventLog[] = [
    { blockNumber: 200n, transactionHash: "0xbbb", topics: [], data: "0x" }
  ];
  const client = makeRpcClient({}, logs);
  const watcher = new ContractEventWatcher("w2", "0xcontract", "base-sepolia", client, 0n);

  await watcher.check();
  assert.equal(watcher.currentFromBlock, 201n);
});

test("ContractEventWatcher: multiple logs picks max block for cursor", async () => {
  const logs: EventLog[] = [
    { blockNumber: 100n, transactionHash: "0xaaa", topics: [], data: "0x" },
    { blockNumber: 300n, transactionHash: "0xbbb", topics: [], data: "0x" },
    { blockNumber: 200n, transactionHash: "0xccc", topics: [], data: "0x" }
  ];
  const client = makeRpcClient({}, logs);
  const watcher = new ContractEventWatcher("w2", "0xcontract", "base-sepolia", client, 0n);

  const result = await watcher.check();
  assert.equal(result.triggered, true);
  assert.equal(watcher.currentFromBlock, 301n);
  if (result.triggered) {
    assert(result.alert.message.includes("3 event(s)"));
  }
});

// ---------------------------------------------------------------------------
// WatcherRegistry tests
// ---------------------------------------------------------------------------

test("WatcherRegistry: registers and lists watchers", () => {
  const client = makeRpcClient();
  const registry = new WatcherRegistry();
  const w1 = new WalletWatcher("w1", "0x1", "base-sepolia", client);
  const w2 = new ContractEventWatcher("w2", "0x2", "base-sepolia", client);

  registry.register(w1);
  registry.register(w2);

  const list = registry.list();
  assert.equal(list.length, 2);
});

test("WatcherRegistry: removes a watcher", () => {
  const client = makeRpcClient();
  const registry = new WatcherRegistry();
  const w1 = new WalletWatcher("w1", "0x1", "base-sepolia", client);
  registry.register(w1);
  registry.remove("w1");
  assert.equal(registry.list().length, 0);
});

test("WatcherRegistry: checkAll returns results for all watchers", async () => {
  const client = makeRpcClient({ "0x1": "500" });
  const registry = new WatcherRegistry();
  registry.register(new WalletWatcher("w1", "0x1", "base-sepolia", client));
  registry.register(new ContractEventWatcher("w2", "0x2", "base-sepolia", client));

  const results = await registry.checkAll();
  assert.equal(results.length, 2);
  assert(results.every((r) => "triggered" in r.result));
});

// ---------------------------------------------------------------------------
// JobScheduler tests
// ---------------------------------------------------------------------------

test("JobScheduler: registers and lists jobs", () => {
  const scheduler = new JobScheduler();
  const job: MonitorJob = { id: "j1", type: "wallet", chainKey: "base-sepolia", address: "0x1", intervalMs: 5000, enabled: true };
  scheduler.register(job, async () => {});
  assert.equal(scheduler.list().length, 1);
});

test("JobScheduler: cancel removes a job", () => {
  const scheduler = new JobScheduler();
  const job: MonitorJob = { id: "j1", type: "wallet", chainKey: "base-sepolia", address: "0x1", intervalMs: 5000, enabled: true };
  scheduler.register(job, async () => {});
  const removed = scheduler.cancel("j1");
  assert.equal(removed, true);
  assert.equal(scheduler.list().length, 0);
});

test("JobScheduler: tick runs enabled jobs that are due", async () => {
  const scheduler = new JobScheduler();
  let ran = 0;
  const job: MonitorJob = { id: "j1", type: "wallet", chainKey: "base-sepolia", address: "0x1", intervalMs: 1000, enabled: true };
  scheduler.register(job, async () => { ran++; });

  await scheduler.tick(Date.now() + 100); // job is due on first tick
  assert.equal(ran, 1);
});

test("JobScheduler: tick skips disabled jobs", async () => {
  const scheduler = new JobScheduler();
  let ran = 0;
  const job: MonitorJob = { id: "j1", type: "wallet", chainKey: "base-sepolia", address: "0x1", intervalMs: 1000, enabled: false };
  scheduler.register(job, async () => { ran++; });

  await scheduler.tick(Date.now() + 100);
  assert.equal(ran, 0);
});

test("JobScheduler: tick respects intervalMs between runs", async () => {
  const scheduler = new JobScheduler();
  let ran = 0;
  const now = Date.now();
  const job: MonitorJob = { id: "j1", type: "wallet", chainKey: "base-sepolia", address: "0x1", intervalMs: 10000, enabled: true };
  scheduler.register(job, async () => { ran++; });

  await scheduler.tick(now + 1); // first run
  await scheduler.tick(now + 2); // should NOT run — intervalMs not elapsed
  assert.equal(ran, 1);
});

test("JobScheduler: job handler error does not crash scheduler", async () => {
  const scheduler = new JobScheduler();
  let secondRan = false;
  const j1: MonitorJob = { id: "j1", type: "wallet", chainKey: "base-sepolia", address: "0x1", intervalMs: 1000, enabled: true };
  const j2: MonitorJob = { id: "j2", type: "contract", chainKey: "base-sepolia", address: "0x2", intervalMs: 1000, enabled: true };

  scheduler.register(j1, async () => { throw new Error("boom"); });
  scheduler.register(j2, async () => { secondRan = true; });

  await scheduler.tick(Date.now() + 100);
  assert.equal(secondRan, true);
});

test("JobScheduler: enable/disable toggles a job", async () => {
  const scheduler = new JobScheduler();
  let ran = 0;
  const job: MonitorJob = { id: "j1", type: "wallet", chainKey: "base-sepolia", address: "0x1", intervalMs: 1000, enabled: true };
  scheduler.register(job, async () => { ran++; });

  scheduler.disable("j1");
  await scheduler.tick(Date.now() + 100);
  assert.equal(ran, 0);

  scheduler.enable("j1");
  await scheduler.tick(Date.now() + 200);
  assert.equal(ran, 1);
});

// ---------------------------------------------------------------------------
// Alert persistence tests
// ---------------------------------------------------------------------------

test("Alert persistence: saveAlert and getAlert round-trip", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const record = makeAlertRecord();
  store.saveAlert(record);

  const fetched = store.getAlert("alert-1");
  assert.ok(fetched);
  assert.equal(fetched.id, "alert-1");
  assert.equal(fetched.type, "wallet_state_change");
  assert.equal(fetched.severity, "info");
  assert.equal(fetched.watcherId, "w1");
  store.close();
});

test("Alert persistence: listAlerts returns all saved alerts", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  store.saveAlert(makeAlertRecord({ id: "a1", watcherId: "w1" }));
  store.saveAlert(makeAlertRecord({ id: "a2", watcherId: "w2" }));

  const all = store.listAlerts();
  assert.equal(all.length, 2);
  store.close();
});

test("Alert persistence: listAlerts filters by watcherId", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  store.saveAlert(makeAlertRecord({ id: "a1", watcherId: "w1" }));
  store.saveAlert(makeAlertRecord({ id: "a2", watcherId: "w2" }));

  const w1Alerts = store.listAlerts({ watcherId: "w1" });
  assert.equal(w1Alerts.length, 1);
  assert.equal(w1Alerts[0].id, "a1");
  store.close();
});

test("Alert persistence: listAlerts filters by resolved status", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  store.saveAlert(makeAlertRecord({ id: "a1" }));
  store.saveAlert(makeAlertRecord({ id: "a2" }));
  store.resolveAlert("a1");

  const unresolved = store.listAlerts({ resolved: false });
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].id, "a2");

  const resolved = store.listAlerts({ resolved: true });
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].id, "a1");
  store.close();
});

test("Alert persistence: resolveAlert sets resolvedAt", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  store.saveAlert(makeAlertRecord({ id: "a1" }));
  store.resolveAlert("a1");

  const alert = store.getAlert("a1");
  assert.ok(alert?.resolvedAt);
  store.close();
});

// ---------------------------------------------------------------------------
// PolicyRunner tests
// ---------------------------------------------------------------------------

test("PolicyRunner: persists alert and resolves after handling", async () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const toolRegistry = new ToolRegistry();
  toolRegistry.register({
    name: "balance",
    description: "Get balance",
    approvalLevel: "read",
    isHighRisk: false,
    execute: async () => ({ balance: "0" })
  });

  const policy: ApprovalPolicy = { requiredLevel: "read", autoApprove: true, denyHighRisk: true };
  const runner = new PolicyRunner(toolRegistry, policy, store);
  const alert = makeAlertRecord({ id: "alert-pol-1" });

  const result = await runner.handleAlert(alert, [{ tool: "balance", args: { address: "0x1", chain: "base-sepolia" } }]);

  assert.equal(result.denied, false);
  assert.equal(result.actionsAttempted, 1);
  assert.equal(result.actionsCompleted, 1);

  const stored = store.getAlert("alert-pol-1");
  assert.ok(stored?.resolvedAt);
  store.close();
});

test("PolicyRunner: denies high-risk follow-up when denyHighRisk is set", async () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const toolRegistry = new ToolRegistry();
  toolRegistry.register({
    name: "drain_balance",
    description: "Drain (HIGH RISK)",
    approvalLevel: "broadcast",
    isHighRisk: true,
    execute: async () => { throw new Error("not allowed"); }
  });

  const policy: ApprovalPolicy = { requiredLevel: "read", autoApprove: true, denyHighRisk: true };
  const runner = new PolicyRunner(toolRegistry, policy, store);
  const alert = makeAlertRecord({ id: "alert-pol-2" });

  const result = await runner.handleAlert(alert, [{ tool: "drain_balance", args: {} }]);

  assert.equal(result.denied, true);
  assert.ok(result.error?.includes("high-risk"));
  assert.equal(result.actionsCompleted, 0);
  store.close();
});

test("PolicyRunner: bounded to MAX 3 follow-up actions", async () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const toolRegistry = new ToolRegistry();
  let callCount = 0;
  for (const name of ["a", "b", "c", "d", "e"]) {
    toolRegistry.register({
      name,
      description: name,
      approvalLevel: "read",
      isHighRisk: false,
      execute: async () => { callCount++; return {}; }
    });
  }

  const policy: ApprovalPolicy = { requiredLevel: "read", autoApprove: true, denyHighRisk: false };
  const runner = new PolicyRunner(toolRegistry, policy, store);
  const alert = makeAlertRecord({ id: "alert-pol-3" });
  const actions = ["a", "b", "c", "d", "e"].map((name) => ({ tool: name, args: {} }));

  const result = await runner.handleAlert(alert, actions);
  assert.equal(result.actionsAttempted, 3); // bounded
  assert.equal(callCount, 3);
  store.close();
});

test("PolicyRunner: approval gate blocks individual actions", async () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const toolRegistry = new ToolRegistry();
  let callCount = 0;
  toolRegistry.register({
    name: "balance",
    description: "Get balance",
    approvalLevel: "read",
    isHighRisk: false,
    execute: async () => { callCount++; return {}; }
  });

  const policy: ApprovalPolicy = { requiredLevel: "read", autoApprove: false, denyHighRisk: false };
  // Gate that rejects everything
  const gate = async () => false;
  const runner = new PolicyRunner(toolRegistry, policy, store, gate);
  const alert = makeAlertRecord({ id: "alert-pol-4" });

  const result = await runner.handleAlert(alert, [{ tool: "balance", args: {} }]);
  assert.equal(result.actionsCompleted, 0);
  assert.equal(callCount, 0);
  store.close();
});

test("PolicyRunner: skips unknown tool names gracefully", async () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const toolRegistry = new ToolRegistry();
  const policy: ApprovalPolicy = { requiredLevel: "read", autoApprove: true, denyHighRisk: false };
  const runner = new PolicyRunner(toolRegistry, policy, store);
  const alert = makeAlertRecord({ id: "alert-pol-5" });

  const result = await runner.handleAlert(alert, [{ tool: "nonexistent", args: {} }]);
  assert.equal(result.actionsCompleted, 0);
  assert.equal(result.denied, false);
  store.close();
});
