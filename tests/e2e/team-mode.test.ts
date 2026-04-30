import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SqliteWorkspaceStore } from "../../packages/memory/src/sqlite-store.ts";
import { PolicyEvaluator, AuditLogger } from "../../packages/platform/src/index.ts";
import { PolicyRunner } from "../../packages/monitor/src/policy-runner.ts";
import { createDefaultToolRegistry } from "../../packages/agent/src/tools.ts";

// ---------------------------------------------------------------------------
// PolicyEvaluator e2e (4)
// ---------------------------------------------------------------------------

test("PolicyEvaluator e2e: ci policy blocks broadcast", () => {
  const evaluator = new PolicyEvaluator({ env: "ci", requiredLevel: "read" });
  const result = evaluator.evaluate("deploy", "broadcast");
  assert.equal(result.allowed, false);
});

test("PolicyEvaluator e2e: local policy allows broadcast", () => {
  const evaluator = new PolicyEvaluator({ env: "local", requiredLevel: "none" });
  const result = evaluator.evaluate("deploy", "broadcast");
  assert.equal(result.allowed, true);
});

test("PolicyEvaluator e2e: team policy forces denyHighRisk", () => {
  const evaluator = new PolicyEvaluator({ env: "team", requiredLevel: "none" });
  const approval = evaluator.toApprovalPolicy();
  assert.equal(approval.denyHighRisk, true);
});

test("PolicyEvaluator e2e: toApprovalPolicy bridges to agent ApprovalPolicy shape", () => {
  const evaluator = new PolicyEvaluator({ env: "local", requiredLevel: "read" });
  const approval = evaluator.toApprovalPolicy();
  assert.ok("requiredLevel" in approval, "missing requiredLevel");
  assert.ok("autoApprove" in approval, "missing autoApprove");
  assert.ok("denyHighRisk" in approval, "missing denyHighRisk");
  const validLevels = ["none", "read", "simulate", "sign", "broadcast"];
  assert.ok(validLevels.includes(approval.requiredLevel), `invalid requiredLevel: ${approval.requiredLevel}`);
});

// ---------------------------------------------------------------------------
// AuditLogger e2e (4)
// ---------------------------------------------------------------------------

test("AuditLogger e2e: log and retrieve round-trip", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "local");
  logger.log("actor-1", "deploy", { allowed: true });
  const records = logger.list({ actorId: "actor-1" });
  assert.equal(records.length, 1);
  assert.equal(records[0].actorId, "actor-1");
  assert.equal(records[0].action, "deploy");
  assert.equal(records[0].allowed, true);
});

test("AuditLogger e2e: denied actions appear in list({ allowed: false })", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "ci");
  logger.log("actor-2", "broadcast", { allowed: false, reason: "level blocked in ci environment" });
  const denied = logger.list({ allowed: false });
  assert.equal(denied.length, 1);
  assert.equal(denied[0].allowed, false);
});

test("AuditLogger e2e: summary reflects mixed log entries", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "local");
  logger.log("actor-3", "read_balance", { allowed: true });
  logger.log("actor-3", "simulate_tx", { allowed: true });
  logger.log("actor-3", "broadcast_tx", { allowed: false, reason: "insufficient approval level" });
  const summary = logger.summary();
  assert.equal(summary.total, 3);
  assert.equal(summary.allowed, 2);
  assert.equal(summary.denied, 1);
});

test("AuditLogger e2e: records survive store re-instantiation", () => {
  const dbPath = join(tmpdir(), `chainmind-audit-e2e-${Date.now()}.db`);
  const store1 = new SqliteWorkspaceStore(dbPath);
  const logger1 = new AuditLogger(store1, "local");
  logger1.log("actor-persist", "sign_tx", { allowed: true });
  store1.close();

  const store2 = new SqliteWorkspaceStore(dbPath);
  const records = store2.listAuditRecords({ actorId: "actor-persist" });
  assert.equal(records.length, 1);
  assert.equal(records[0].actorId, "actor-persist");
  store2.close();
});

// ---------------------------------------------------------------------------
// Platform + Monitor integration (4)
// ---------------------------------------------------------------------------

test("Platform+Monitor: PolicyRunner respects denyHighRisk from platform policy", async () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const registry = createDefaultToolRegistry();

  // Build an ApprovalPolicy from platform's PolicyEvaluator
  const evaluator = new PolicyEvaluator({ env: "team", requiredLevel: "none" });
  const policy = evaluator.toApprovalPolicy();

  const runner = new PolicyRunner(registry, policy, store);
  const alert = {
    id: "alert-e2e-1",
    type: "policy_action" as const,
    watcherId: "watcher-1",
    message: "test alert",
    severity: "info" as const,
    dataJson: "{}",
    triggeredAt: new Date().toISOString()
  };

  // drain_balance is high-risk — should be denied by denyHighRisk: true
  const result = await runner.handleAlert(alert, [{ tool: "drain_balance", args: {} }]);
  assert.equal(result.denied, true);
});

test("Platform+Monitor: AuditLogger captures policy evaluation result", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "ci");
  const evaluator = new PolicyEvaluator({ env: "ci", requiredLevel: "read" });
  const evalResult = evaluator.evaluate("broadcast_tx", "broadcast");
  logger.log("ci-actor", "broadcast_tx", evalResult);
  const records = logger.list({ actorId: "ci-actor" });
  assert.equal(records.length, 1);
  assert.equal(records[0].allowed, evalResult.allowed);
});

test("Platform+Monitor: team env blocks insufficient approval level", () => {
  // team policy requires broadcast level; evaluating with sign level should fail
  const evaluator = new PolicyEvaluator({ env: "team", requiredLevel: "broadcast" });
  const result = evaluator.evaluate("tx:sign", "sign");
  assert.equal(result.allowed, false);
});

test("Platform+Monitor: toApprovalPolicy integrates with agent approval gate", () => {
  const evaluator = new PolicyEvaluator({ env: "local", requiredLevel: "read", autoApprove: true });
  const approval = evaluator.toApprovalPolicy();
  const validLevels = ["none", "read", "simulate", "sign", "broadcast"];
  assert.ok(typeof approval.requiredLevel === "string", "requiredLevel must be string");
  assert.ok(validLevels.includes(approval.requiredLevel), "requiredLevel must be valid ApprovalLevel");
  assert.ok(typeof approval.autoApprove === "boolean", "autoApprove must be boolean");
  assert.ok(typeof approval.denyHighRisk === "boolean", "denyHighRisk must be boolean");
  // autoApprove: true should be forwarded
  assert.equal(approval.autoApprove, true);
});
