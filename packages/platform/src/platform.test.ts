import test from "node:test";
import assert from "node:assert/strict";

import { SqliteWorkspaceStore } from "../../memory/src/sqlite-store.ts";
import { PolicyEvaluator } from "./policy.ts";
import { AuditLogger } from "./audit-log.ts";

// ── PolicyEvaluator tests ─────────────────────────────────────────────────────

test("PolicyEvaluator: local env allows read level", () => {
  const evaluator = new PolicyEvaluator({ env: "local", requiredLevel: "read" });
  const result = evaluator.evaluate("transfer", "read");
  assert.equal(result.allowed, true);
});

test("PolicyEvaluator: local env allows write level", () => {
  const evaluator = new PolicyEvaluator({ env: "local", requiredLevel: "read" });
  const result = evaluator.evaluate("transfer", "write");
  assert.equal(result.allowed, true);
});

test("PolicyEvaluator: local env allows sign level", () => {
  const evaluator = new PolicyEvaluator({ env: "local", requiredLevel: "read" });
  const result = evaluator.evaluate("transfer", "sign");
  assert.equal(result.allowed, true);
});

test("PolicyEvaluator: local env allows broadcast level", () => {
  const evaluator = new PolicyEvaluator({ env: "local", requiredLevel: "read" });
  const result = evaluator.evaluate("transfer", "broadcast");
  assert.equal(result.allowed, true);
});

test("PolicyEvaluator: ci env allows read level", () => {
  const evaluator = new PolicyEvaluator({ env: "ci", requiredLevel: "read" });
  const result = evaluator.evaluate("balance", "read");
  assert.equal(result.allowed, true);
});

test("PolicyEvaluator: ci env allows write level", () => {
  const evaluator = new PolicyEvaluator({ env: "ci", requiredLevel: "read" });
  const result = evaluator.evaluate("simulate", "write");
  assert.equal(result.allowed, true);
});

test("PolicyEvaluator: ci env blocks sign level", () => {
  const evaluator = new PolicyEvaluator({ env: "ci", requiredLevel: "read" });
  const result = evaluator.evaluate("sign-tx", "sign");
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "level blocked in ci environment");
});

test("PolicyEvaluator: ci env blocks broadcast level", () => {
  const evaluator = new PolicyEvaluator({ env: "ci", requiredLevel: "read" });
  const result = evaluator.evaluate("broadcast-tx", "broadcast");
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "level blocked in ci environment");
});

test("PolicyEvaluator: ci env forces denyHighRisk even when caller sets false", () => {
  const evaluator = new PolicyEvaluator({ env: "ci", requiredLevel: "read", denyHighRisk: false });
  const policy = evaluator.toApprovalPolicy();
  assert.equal(policy.denyHighRisk, true);
});

test("PolicyEvaluator: team env allows write level", () => {
  const evaluator = new PolicyEvaluator({ env: "team", requiredLevel: "read" });
  const result = evaluator.evaluate("transfer", "write");
  assert.equal(result.allowed, true);
});

test("PolicyEvaluator: team env forces denyHighRisk by default", () => {
  const evaluator = new PolicyEvaluator({ env: "team", requiredLevel: "read" });
  const policy = evaluator.toApprovalPolicy();
  assert.equal(policy.denyHighRisk, true);
});

test("PolicyEvaluator: team env respects explicit denyHighRisk: false", () => {
  const evaluator = new PolicyEvaluator({ env: "team", requiredLevel: "read", denyHighRisk: false });
  const policy = evaluator.toApprovalPolicy();
  assert.equal(policy.denyHighRisk, false);
});

test("PolicyEvaluator: allowedActions non-empty blocks action not in list", () => {
  const evaluator = new PolicyEvaluator({ env: "local", requiredLevel: "read", allowedActions: ["balance"] });
  const result = evaluator.evaluate("transfer", "read");
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "action not in allowlist");
});

test("PolicyEvaluator: allowedActions non-empty allows action in list", () => {
  const evaluator = new PolicyEvaluator({ env: "local", requiredLevel: "read", allowedActions: ["balance", "transfer"] });
  const result = evaluator.evaluate("transfer", "read");
  assert.equal(result.allowed, true);
});

test("PolicyEvaluator: toApprovalPolicy maps write to simulate and returns correct shape", () => {
  const evaluator = new PolicyEvaluator({ env: "local", requiredLevel: "write", autoApprove: true });
  const policy = evaluator.toApprovalPolicy();
  assert.equal(policy.requiredLevel, "simulate");
  assert.equal(policy.autoApprove, true);
  assert.equal(policy.denyHighRisk, false);
});

// ── AuditLogger tests ─────────────────────────────────────────────────────────

test("AuditLogger: log() stores a record retrievable via list()", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "local");
  logger.log("user1", "transfer", { allowed: true });
  const records = logger.list();
  assert.equal(records.length, 1);
});

test("AuditLogger: log() sets id as truthy string", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "local");
  logger.log("user1", "transfer", { allowed: true });
  const records = logger.list();
  assert.ok(records[0].id);
  assert.equal(typeof records[0].id, "string");
});

test("AuditLogger: log() sets timestamp as valid ISO-8601", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "local");
  logger.log("user1", "transfer", { allowed: true });
  const records = logger.list();
  const ts = records[0].timestamp;
  assert.ok(ts);
  assert.ok(!isNaN(new Date(ts).getTime()));
});

test("AuditLogger: log() sets actorId correctly", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "local");
  logger.log("alice", "transfer", { allowed: true });
  const records = logger.list();
  assert.equal(records[0].actorId, "alice");
});

test("AuditLogger: log() sets action correctly", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "local");
  logger.log("alice", "deploy-contract", { allowed: true });
  const records = logger.list();
  assert.equal(records[0].action, "deploy-contract");
});

test("AuditLogger: log() sets allowed: true for allowed result", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "local");
  logger.log("alice", "transfer", { allowed: true });
  const records = logger.list();
  assert.equal(records[0].allowed, true);
});

test("AuditLogger: log() sets allowed: false for denied result", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "ci");
  logger.log("alice", "broadcast-tx", { allowed: false, reason: "level blocked in ci environment" });
  const records = logger.list();
  assert.equal(records[0].allowed, false);
});

test("AuditLogger: log() stores reason when provided", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "ci");
  logger.log("alice", "sign-tx", { allowed: false, reason: "level blocked in ci environment" });
  const records = logger.list();
  assert.equal(records[0].reason, "level blocked in ci environment");
});

test("AuditLogger: log() stores serialised metadata when provided", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "local");
  logger.log("alice", "transfer", { allowed: true }, { chainId: 1, amount: "1.5" });
  const records = logger.list();
  const meta = JSON.parse(records[0].metadata as string) as Record<string, unknown>;
  assert.equal(meta.chainId, 1);
  assert.equal(meta.amount, "1.5");
});

test("AuditLogger: list() returns records newest-first", async () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "local");
  logger.log("alice", "first", { allowed: true });
  // small delay to ensure different timestamps
  await new Promise<void>((resolve) => setTimeout(resolve, 2));
  logger.log("alice", "second", { allowed: true });
  const records = logger.list();
  assert.equal(records[0].action, "second");
  assert.equal(records[1].action, "first");
});

test("AuditLogger: list({ actorId }) filters by actor", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "local");
  logger.log("alice", "transfer", { allowed: true });
  logger.log("bob", "balance", { allowed: true });
  const records = logger.list({ actorId: "alice" });
  assert.equal(records.length, 1);
  assert.equal(records[0].actorId, "alice");
});

test("AuditLogger: list({ allowed: false }) returns only denied", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "ci");
  logger.log("alice", "balance", { allowed: true });
  logger.log("alice", "sign-tx", { allowed: false, reason: "level blocked in ci environment" });
  logger.log("bob", "broadcast-tx", { allowed: false, reason: "level blocked in ci environment" });
  const denied = logger.list({ allowed: false });
  assert.equal(denied.length, 2);
  assert.ok(denied.every((r) => r.allowed === false));
});

test("AuditLogger: list({ since }) filters by timestamp", async () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "local");
  logger.log("alice", "old-action", { allowed: true });
  await new Promise<void>((resolve) => setTimeout(resolve, 2));
  const cutoff = new Date().toISOString();
  await new Promise<void>((resolve) => setTimeout(resolve, 2));
  logger.log("alice", "new-action", { allowed: true });
  const records = logger.list({ since: cutoff });
  assert.equal(records.length, 1);
  assert.equal(records[0].action, "new-action");
});

test("AuditLogger: summary() returns correct total, allowed, denied", () => {
  const store = new SqliteWorkspaceStore(":memory:");
  const logger = new AuditLogger(store, "local");
  logger.log("alice", "action1", { allowed: true });
  logger.log("alice", "action2", { allowed: true });
  logger.log("alice", "action3", { allowed: false, reason: "insufficient approval level" });
  const s = logger.summary();
  assert.equal(s.total, 3);
  assert.equal(s.allowed, 2);
  assert.equal(s.denied, 1);
});

test("AuditLogger: summary().byEnv counts correctly for multiple envs", () => {
  const storeLocal = new SqliteWorkspaceStore(":memory:");
  // Use separate loggers writing to the same store, different envs
  const loggerLocal = new AuditLogger(storeLocal, "local");
  const loggerCi = new AuditLogger(storeLocal, "ci");
  const loggerTeam = new AuditLogger(storeLocal, "team");

  loggerLocal.log("alice", "action1", { allowed: true });
  loggerLocal.log("alice", "action2", { allowed: true });
  loggerCi.log("alice", "action3", { allowed: true });
  loggerTeam.log("alice", "action4", { allowed: false });

  // summary from any logger reads all records in the store
  const s = loggerLocal.summary();
  assert.equal(s.byEnv["local"], 2);
  assert.equal(s.byEnv["ci"], 1);
  assert.equal(s.byEnv["team"], 1);
});
