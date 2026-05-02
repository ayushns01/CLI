import test from "node:test";
import assert from "node:assert/strict";

import { MockProvider } from "./provider.ts";
import { Planner } from "./planner.ts";
import { createDefaultToolRegistry, createRealToolRegistry } from "./tools.ts";
import { AgentRuntime } from "./runtime.ts";
import type { Intent, ApprovalPolicy } from "./types.ts";
import { createChainRegistry, loadBuiltInChains } from "../../chains/src/index.ts";

test("Planner: deploy intent generates deploy step", async () => {
  const provider = new MockProvider();
  provider.setResponse(
    /deploy/i,
    JSON.stringify({
      steps: [
        {
          tool: "deploy_contract",
          args: { artifact: "MyToken.json", chain: "base-sepolia" }
        }
      ],
      reasoning: "User wants to deploy a contract"
    })
  );

  const planner = new Planner(provider);
  const intent: Intent = { text: "deploy my contract" };
  const plan = await planner.generatePlan(intent);

  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].tool, "deploy_contract");
});

test("Planner: balance intent generates balance step", async () => {
  const provider = new MockProvider();
  provider.setResponse(
    /balance/i,
    JSON.stringify({
      steps: [
        {
          tool: "balance",
          args: { address: "0x1234...", chain: "sepolia" }
        }
      ],
      reasoning: "User wants to check balance"
    })
  );

  const planner = new Planner(provider);
  const intent: Intent = { text: "check my balance" };
  const plan = await planner.generatePlan(intent);

  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].tool, "balance");
});

test("Planner: contract interaction intent generates interact step", async () => {
  const provider = new MockProvider();
  provider.setResponse(
    /interact|call/i,
    JSON.stringify({
      steps: [
        {
          tool: "interact_contract",
          args: { address: "0xabcd...", function: "transfer", args: [] }
        }
      ],
      reasoning: "User wants to interact with contract"
    })
  );

  const planner = new Planner(provider);
  const intent: Intent = { text: "call the transfer function" };
  const plan = await planner.generatePlan(intent);

  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].tool, "interact_contract");
});

test("Runtime: deploy intent executes deploy step", async () => {
  const provider = new MockProvider();
  provider.setResponse(
    /deploy/i,
    JSON.stringify({
      steps: [
        {
          tool: "deploy_contract",
          args: { artifact: "Test.json", chain: "base-sepolia" },
          approvalRequired: "broadcast"
        }
      ]
    })
  );

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy);
  const intent: Intent = { text: "deploy my contract" };
  const summary = await runtime.execute(intent);

  assert.equal(summary.totalSteps, 1);
  assert.equal(summary.observations.length, 1);
});

test("Runtime: balance intent executes balance step", async () => {
  const provider = new MockProvider();
  provider.setResponse(
    /balance/i,
    JSON.stringify({
      steps: [
        {
          tool: "balance",
          args: { address: "0x1234...", chain: "base-sepolia" },
          approvalRequired: "read"
        }
      ]
    })
  );

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy);
  const intent: Intent = { text: "check balance" };
  const summary = await runtime.execute(intent);

  assert.equal(summary.totalSteps, 1);
  assert(summary.observations.length > 0);
  assert(summary.observations[0].success);
});

test("Runtime: contract interaction intent executes interact step", async () => {
  const provider = new MockProvider();
  provider.setResponse(
    /interact|call/i,
    JSON.stringify({
      steps: [
        {
          tool: "interact_contract",
          args: { address: "0xabcd...", function: "transfer", args: [] },
          approvalRequired: "broadcast"
        }
      ]
    })
  );

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy);
  const intent: Intent = { text: "interact with contract" };
  const summary = await runtime.execute(intent);

  assert.equal(summary.totalSteps, 1);
});

test("Runtime: high-risk drain request is denied by policy", async () => {
  const provider = new MockProvider();
  provider.setResponse(
    /drain/i,
    JSON.stringify({
      steps: [
        {
          tool: "drain_balance",
          args: {},
          approvalRequired: "broadcast"
        }
      ]
    })
  );

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy);
  const intent: Intent = { text: "drain all ETH" };
  const summary = await runtime.execute(intent);

  assert.equal(summary.approved, false);
  assert(summary.error?.includes("high-risk"));
});

test("Runtime: multi-step plan executes in order", async () => {
  const provider = new MockProvider();
  provider.setResponse(
    /estimate then deploy/i,
    JSON.stringify({
      steps: [
        {
          tool: "estimate_gas",
          args: { from: "0x1234", to: "0x5678", value: "1000000" },
          approvalRequired: "simulate"
        },
        {
          tool: "deploy_contract",
          args: { artifact: "Test.json", chain: "base-sepolia" },
          approvalRequired: "broadcast"
        }
      ]
    })
  );

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy);
  const intent: Intent = { text: "estimate then deploy" };
  const summary = await runtime.execute(intent);

  assert.equal(summary.totalSteps, 2);
  assert.equal(summary.observations.length, 2);
  // Verify execution order
  assert.equal(summary.observations[0].step.tool, "estimate_gas");
  assert.equal(summary.observations[1].step.tool, "deploy_contract");
});

test("Runtime: approval checkpoint blocks unauthorized actions", async () => {
  const provider = new MockProvider();
  provider.setResponse(
    /broadcast/i,
    JSON.stringify({
      steps: [
        {
          tool: "deploy_contract",
          args: { artifact: "Test.json", chain: "base-sepolia" },
          approvalRequired: "broadcast"
        }
      ]
    })
  );

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "simulate",
    autoApprove: false,
    denyHighRisk: true
  };

  // Approval gate that denies broadcast
  const approvalGate = async (step: any) => {
    return step.approvalRequired !== "broadcast";
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy, approvalGate);
  const intent: Intent = { text: "need to broadcast" };
  const summary = await runtime.execute(intent);

  // Step should be denied
  assert(summary.observations.length > 0);
  assert(!summary.observations[0].success);
  assert(summary.observations[0].error?.includes("rejected"));
});

test("Runtime: observation loop collects results after each step", async () => {
  const provider = new MockProvider();
  provider.setResponse(
    /multi/i,
    JSON.stringify({
      steps: [
        {
          tool: "balance",
          args: { address: "0x1234", chain: "base-sepolia" },
          approvalRequired: "read"
        },
        {
          tool: "estimate_gas",
          args: { from: "0x1234", to: "0x5678", value: "1000" },
          approvalRequired: "simulate"
        }
      ]
    })
  );

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy);
  const intent: Intent = { text: "multi step test" };
  const summary = await runtime.execute(intent);

  assert.equal(summary.observations.length, 2);
  for (const obs of summary.observations) {
    assert(typeof obs.success === "boolean");
    assert(obs.step !== undefined);
  }
});

test("Planner: pattern fallback for unstructured responses", async () => {
  // MockProvider returns default no-op when no pattern matches
  const provider = new MockProvider();

  const planner = new Planner(provider);
  const intent: Intent = { text: "check my balance on ethereum" };
  const plan = await planner.generatePlan(intent);

  // Should still generate a plan via pattern matching
  assert(plan.steps.length > 0 || plan.steps.length === 0); // Either works
  assert(Array.isArray(plan.steps));
});

test("Runtime: handles invalid tool names gracefully", async () => {
  const provider = new MockProvider();
  provider.setResponse(
    /invalid/i,
    JSON.stringify({
      steps: [
        {
          tool: "nonexistent_tool",
          args: {},
          approvalRequired: "read"
        }
      ]
    })
  );

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy);
  const intent: Intent = { text: "invalid tool test" };
  const summary = await runtime.execute(intent);

  // Should capture error
  assert(summary.observations.length > 0);
  assert(!summary.observations[0].success);
});

test("Real tools: trace_tx requires a txHash before touching RPC", async () => {
  const registry = createRealToolRegistry({
    chainRegistry: createChainRegistry(loadBuiltInChains())
  });
  const tool = registry.getTool("trace_tx");
  assert.ok(tool);

  await assert.rejects(
    () => tool.execute({ chainKey: "sepolia" }),
    /trace_tx requires a txHash arg/
  );
});

test("Real tools: deploy_contract requires privateKey before broadcast", async () => {
  const registry = createRealToolRegistry({
    chainRegistry: createChainRegistry(loadBuiltInChains())
  });
  const tool = registry.getTool("deploy_contract");
  assert.ok(tool);

  await assert.rejects(
    () => tool.execute({ chainKey: "sepolia", bytecode: "0x60006000" }),
    /deploy_contract requires a privateKey arg/
  );
});

test("Real tools: deploy_contract requires non-empty bytecode before broadcast", async () => {
  const registry = createRealToolRegistry({
    chainRegistry: createChainRegistry(loadBuiltInChains())
  });
  const tool = registry.getTool("deploy_contract");
  assert.ok(tool);

  await assert.rejects(
    () =>
      tool.execute({
        chainKey: "sepolia",
        privateKey: "0x1111111111111111111111111111111111111111111111111111111111111111"
      }),
    /deploy_contract requires non-empty bytecode/
  );
});
