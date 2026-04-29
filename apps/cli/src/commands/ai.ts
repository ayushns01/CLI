/**
 * chainmind ai "<intent>"
 *
 * Command that wires the agent runtime and prints a structured summary.
 */

import { Planner } from "@chainmind/agent/src/planner.ts";
import { AgentRuntime } from "@chainmind/agent/src/runtime.ts";
import { createDefaultToolRegistry } from "@chainmind/agent/src/tools.ts";
import { createMockProvider } from "@chainmind/agent/src/provider.ts";
import type { ApprovalPolicy } from "@chainmind/agent/src/types.ts";

export async function aiCommand(intent: string): Promise<void> {
  // Create provider
  const provider = createMockProvider();

  // Create planner
  const planner = new Planner(provider);

  // Create tool registry
  const toolRegistry = createDefaultToolRegistry();

  // Create approval policy (read-only by default in CLI)
  const policy: ApprovalPolicy = {
    requiredLevel: "read",
    autoApprove: true,
    denyHighRisk: true
  };

  // Create runtime
  const runtime = new AgentRuntime(planner, toolRegistry, policy);

  // Execute intent
  const summary = await runtime.execute({ text: intent });

  // Print structured summary
  console.log(JSON.stringify(summary, null, 2));
}
