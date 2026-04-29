/**
 * End-to-end tests for agent workflows.
 * Tests the integration of provider, planner, runtime, and tool registry.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { MockProvider } from "../../packages/agent/src/provider.ts";
import { Planner } from "../../packages/agent/src/planner.ts";
import { createDefaultToolRegistry } from "../../packages/agent/src/tools.ts";
import { AgentRuntime } from "../../packages/agent/src/runtime.ts";
import type { ApprovalPolicy } from "../../packages/agent/src/types.ts";

test("E2E: agent can execute a simple balance check workflow", async () => {
  const provider = new MockProvider({
    [/balance|check/i]: JSON.stringify({
      steps: [
        {
          tool: "balance",
          args: { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f42472", chain: "base-sepolia" },
          approvalRequired: "read"
        }
      ],
      reasoning: "User wants to check their balance"
    })
  });

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy);
  const summary = await runtime.execute({ text: "check my balance on base-sepolia" });

  assert.equal(summary.totalSteps, 1);
  assert.equal(summary.completedSteps, 1);
  assert(summary.approved);
  assert.equal(summary.observations.length, 1);
  assert(summary.observations[0].success);
});

test("E2E: agent can plan a multi-step deploy workflow", async () => {
  const provider = new MockProvider({
    [/deploy.*erc20/i]: JSON.stringify({
      steps: [
        {
          tool: "estimate_gas",
          args: {
            from: "0x742d35Cc6634C0532925a3b844Bc9e7595f42472",
            to: "",
            data: "0x...",
            chain: "base-sepolia"
          },
          approvalRequired: "simulate"
        },
        {
          tool: "deploy_contract",
          args: {
            artifact: "ERC20.json",
            chain: "base-sepolia",
            constructorArgs: []
          },
          approvalRequired: "broadcast"
        }
      ],
      reasoning: "User wants to deploy an ERC20 token"
    })
  });

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy);
  const summary = await runtime.execute({ text: "deploy an ERC20 token on base-sepolia" });

  assert.equal(summary.totalSteps, 2);
  assert.equal(summary.observations.length, 2);
  // First step (estimate) should succeed
  assert(summary.observations[0].success);
});

test("E2E: agent denies drain request at policy level", async () => {
  const provider = new MockProvider({
    [/drain/i]: JSON.stringify({
      steps: [
        {
          tool: "drain_balance",
          args: { address: "0x742d35Cc6634C0532925a3b844Bc9e7595f42472" },
          approvalRequired: "broadcast"
        }
      ],
      reasoning: "User requested drain (HIGH RISK)"
    })
  });

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy);
  const summary = await runtime.execute({ text: "drain all my balance to another address" });

  assert.equal(summary.approved, false);
  assert(summary.error?.includes("high-risk"));
  assert.equal(summary.completedSteps, 0);
});

test("E2E: agent workflow respects approval gates", async () => {
  const provider = new MockProvider({
    [/simulate/i]: JSON.stringify({
      steps: [
        {
          tool: "simulate_tx",
          args: { to: "0xabcd", data: "0x...", from: "0x1234" },
          approvalRequired: "simulate"
        }
      ],
      reasoning: "User wants to simulate a transaction"
    })
  });

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "broadcast",
    autoApprove: false,
    denyHighRisk: true
  };

  // Gate that auto-rejects simulate-level requests
  const approvalGate = async (step: any) => {
    return step.approvalRequired !== "simulate";
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy, approvalGate);
  const summary = await runtime.execute({ text: "simulate this transaction" });

  // Request should be denied
  assert(summary.observations.length > 0);
  assert(!summary.observations[0].success);
});

test("E2E: agent recovers gracefully from invalid plan", async () => {
  const provider = new MockProvider({
    [/.*unknown.*/i]: "not valid json"
  });

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy);
  const summary = await runtime.execute({ text: "unknown workflow" });

  // Should not crash; may have empty steps or fallback plan
  assert(Array.isArray(summary.plan.steps));
  assert(typeof summary.approved === "boolean");
});

test("E2E: agent executes trace workflow correctly", async () => {
  const provider = new MockProvider({
    [/trace|debug/i]: JSON.stringify({
      steps: [
        {
          tool: "trace_tx",
          args: { txHash: "0x123abc...", chain: "base-sepolia" },
          approvalRequired: "read"
        }
      ],
      reasoning: "User wants to trace a transaction"
    })
  });

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy);
  const summary = await runtime.execute({ text: "trace transaction 0x123abc" });

  assert.equal(summary.totalSteps, 1);
  assert(summary.observations.length > 0);
  assert(summary.observations[0].success);
});

test("E2E: agent can handle empty intent gracefully", async () => {
  const provider = new MockProvider({});

  const planner = new Planner(provider);
  const toolRegistry = createDefaultToolRegistry();
  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  const runtime = new AgentRuntime(planner, toolRegistry, policy);
  const summary = await runtime.execute({ text: "" });

  // Should handle gracefully
  assert(typeof summary.totalSteps === "number");
  assert(typeof summary.completedSteps === "number");
  assert(Array.isArray(summary.observations));
});
