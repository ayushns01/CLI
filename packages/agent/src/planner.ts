/**
 * Intent parsing and plan generation.
 * Converts natural-language intent to a typed Plan (list of Steps).
 */

import type { LLMProvider } from "./provider.ts";
import type { Intent, Plan, Step } from "./types.ts";

/**
 * Parse an intent string and extract the action and keywords.
 * Used for pattern matching when the provider doesn't return structured JSON.
 */
function parseIntentPattern(text: string): { action: string; keywords: string[] } {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("balance") || lowerText.includes("how much")) {
    return { action: "balance", keywords: [] };
  }
  if (lowerText.includes("deploy") || lowerText.includes("contract")) {
    return { action: "deploy", keywords: [] };
  }
  if (lowerText.includes("interact") || lowerText.includes("call")) {
    return { action: "interact", keywords: [] };
  }
  if (lowerText.includes("trace") || lowerText.includes("debug")) {
    return { action: "trace", keywords: [] };
  }
  if (
    lowerText.includes("drain") ||
    lowerText.includes("force") ||
    lowerText.includes("withdraw all")
  ) {
    return { action: "drain", keywords: [] };
  }

  return { action: "unknown", keywords: [] };
}

/**
 * Planner: converts intent to plan using an LLM provider.
 */
export class Planner {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  /**
   * Generate a plan from an intent.
   * The provider returns a JSON string with steps; if parsing fails,
   * fallback to pattern matching.
   */
  async generatePlan(intent: Intent): Promise<Plan> {
    const prompt = `You are an expert agent orchestrator for EVM blockchain operations.
Given the following user intent, generate a JSON plan with a list of steps.

User Intent: "${intent.text}"

Return ONLY a JSON object with this structure:
{
  "steps": [
    { "tool": "balance", "args": { "address": "0x...", "chain": "..." } },
    ...
  ],
  "reasoning": "Optional explanation"
}

Available tools: balance, balances_multi, deploy_contract, interact_contract, estimate_gas, simulate_tx, trace_tx, fork_chain

Respond with ONLY the JSON, no additional text.`;

    try {
      const response = await this.provider.complete(prompt);
      const parsed = JSON.parse(response);

      if (parsed.steps && Array.isArray(parsed.steps)) {
        return {
          steps: parsed.steps.map((step: unknown) => {
            const s = step as Record<string, unknown>;
            return {
              tool: String(s.tool || ""),
              args: (s.args as Record<string, unknown>) || {},
              approvalRequired: (s.approvalRequired as string) || undefined
            } as Step;
          }),
          reasoning: String(parsed.reasoning || "")
        };
      }
    } catch {
      // JSON parse failed; fall back to pattern matching
    }

    // Pattern-based fallback
    const { action } = parseIntentPattern(intent.text);

    switch (action) {
      case "balance":
        return {
          steps: [
            {
              tool: "balance",
              args: { address: "0x1111111111111111111111111111111111111111", chain: "base-sepolia" },
              approvalRequired: "read"
            }
          ],
          reasoning: "User asked about balance"
        };

      case "deploy":
        return {
          steps: [
            {
              tool: "deploy_contract",
              args: { artifact: "", chain: "base-sepolia" },
              approvalRequired: "broadcast"
            }
          ],
          reasoning: "User asked to deploy a contract"
        };

      case "interact":
        return {
          steps: [
            {
              tool: "interact_contract",
              args: { address: "0x...", function: "", args: [] },
              approvalRequired: "broadcast"
            }
          ],
          reasoning: "User asked to interact with a contract"
        };

      case "trace":
        return {
          steps: [
            {
              tool: "trace_tx",
              args: { txHash: "" },
              approvalRequired: "read"
            }
          ],
          reasoning: "User asked to trace a transaction"
        };

      case "drain":
        return {
          steps: [
            {
              tool: "drain_balance",
              args: {},
              approvalRequired: "broadcast"
            }
          ],
          reasoning: "User requested a high-risk operation"
        };

      default:
        return {
          steps: [],
          reasoning: "Intent not recognized"
        };
    }
  }
}

/**
 * Create a planner with an LLM provider.
 */
export function createPlanner(provider: LLMProvider): Planner {
  return new Planner(provider);
}
