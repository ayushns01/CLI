/**
 * Agentic runtime.
 * Core execution loop: receives intent → calls planner → dispatches tools step-by-step
 * → enforces approval checkpoints → aggregates observations → returns structured summary.
 */

import type { Intent, Plan, Observation, AgentSummary, ApprovalPolicy, Step } from "./types.ts";
import type { Planner } from "./planner.ts";
import type { ToolRegistry } from "./tools.ts";

/**
 * Approval gate callback.
 * Return true to approve, false to deny.
 */
export type ApprovalGate = (step: Step, policy: ApprovalPolicy) => Promise<boolean>;

/**
 * Agent runtime.
 */
export class AgentRuntime {
  private observations: Observation[] = [];
  private planner: Planner;
  private toolRegistry: ToolRegistry;
  private policy: ApprovalPolicy;
  private approvalGate?: ApprovalGate;

  constructor(
    planner: Planner,
    toolRegistry: ToolRegistry,
    policy: ApprovalPolicy,
    approvalGate?: ApprovalGate
  ) {
    this.planner = planner;
    this.toolRegistry = toolRegistry;
    this.policy = policy;
    this.approvalGate = approvalGate;
  }

  /**
   * Execute an intent and return a summary.
   */
  async execute(intent: Intent): Promise<AgentSummary> {
    this.observations = [];

    // Generate plan
    let plan: Plan;
    try {
      plan = await this.planner.generatePlan(intent);
    } catch (error) {
      return {
        intent: intent.text,
        plan: { steps: [] },
        observations: [],
        approved: false,
        error: `Failed to generate plan: ${error instanceof Error ? error.message : String(error)}`,
        totalSteps: 0,
        completedSteps: 0
      };
    }

    // Check if plan involves high-risk operations
    const hasHighRisk = plan.steps.some((step) => {
      const tool = this.toolRegistry.getTool(step.tool);
      return tool && tool.isHighRisk;
    });

    if (hasHighRisk && this.policy.denyHighRisk) {
      return {
        intent: intent.text,
        plan,
        observations: [],
        approved: false,
        error: "Plan contains high-risk operations which are denied by policy",
        totalSteps: plan.steps.length,
        completedSteps: 0
      };
    }

    // Execute steps
    let stepIndex = 0;
    for (const step of plan.steps) {
      try {
        // Check approval
        const approved = await this.checkApproval(step);
        if (!approved) {
          const observation: Observation = {
            step,
            success: false,
            error: "Step rejected by approval policy"
          };
          this.observations.push(observation);
          // Stop execution on approval denial
          break;
        }

        // Execute tool
        const tool = this.toolRegistry.getTool(step.tool);
        if (!tool) {
          const observation: Observation = {
            step,
            success: false,
            error: `Tool not found: ${step.tool}`
          };
          this.observations.push(observation);
          break;
        }

        const result = await tool.execute(step.args);
        const observation: Observation = {
          step,
          success: true,
          result
        };
        this.observations.push(observation);
        stepIndex++;
      } catch (error) {
        const observation: Observation = {
          step,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
        this.observations.push(observation);
        break;
      }
    }

    // Determine final success
    const finalSuccess =
      this.observations.length > 0 && this.observations.every((o) => o.success);
    const finalResult = this.observations.length > 0 ? this.observations[this.observations.length - 1].result : undefined;

    return {
      intent: intent.text,
      plan,
      observations: this.observations,
      approved: !hasHighRisk || !this.policy.denyHighRisk,
      finalResult: finalSuccess ? finalResult : undefined,
      error: finalSuccess ? undefined : "Execution failed or was interrupted",
      totalSteps: plan.steps.length,
      completedSteps: stepIndex
    };
  }

  /**
   * Check if a step requires approval and if so, get approval.
   */
  private async checkApproval(step: Step): Promise<boolean> {
    const tool = this.toolRegistry.getTool(step.tool);
    if (!tool) {
      return false;
    }

    // Determine required approval level
    const requiredLevel = step.approvalRequired || tool.approvalLevel;

    // Map approval levels to numeric priorities for comparison
    const levelPriority: Record<string, number> = {
      none: 0,
      read: 1,
      simulate: 2,
      sign: 3,
      broadcast: 4
    };

    const toolPriority = levelPriority[requiredLevel] || 0;
    const policyPriority = levelPriority[this.policy.requiredLevel] || 0;

    // If tool's approval level is below policy requirement, auto-deny
    if (toolPriority < policyPriority) {
      return false;
    }

    // If auto-approve is enabled, approve
    if (this.policy.autoApprove) {
      return true;
    }

    // Otherwise, ask approval gate
    if (this.approvalGate) {
      return await this.approvalGate(step, this.policy);
    }

    // Default to requiring explicit approval
    return false;
  }
}

/**
 * Create an agent runtime.
 */
export function createRuntime(
  planner: Planner,
  toolRegistry: ToolRegistry,
  policy: ApprovalPolicy,
  approvalGate?: ApprovalGate
): AgentRuntime {
  return new AgentRuntime(planner, toolRegistry, policy, approvalGate);
}
