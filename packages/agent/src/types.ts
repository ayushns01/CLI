/**
 * Type definitions for the agentic runtime.
 */

export type ApprovalLevel = "read" | "simulate" | "sign" | "broadcast" | "none";

export interface ApprovalPolicy {
  /**
   * Minimum approval level required for different actions.
   * Actions below this level are auto-approved.
   */
  requiredLevel: ApprovalLevel;

  /**
   * If true, auto-approve actions at the required level (for testing).
   * If false, require explicit user approval.
   */
  autoApprove: boolean;

  /**
   * If true, deny high-risk actions completely (drain, force-withdraw, etc).
   */
  denyHighRisk: boolean;
}

export interface Intent {
  text: string;
  timestamp?: number;
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface Step {
  tool: string;
  args: Record<string, unknown>;
  approvalRequired?: ApprovalLevel;
}

export interface Plan {
  steps: Step[];
  reasoning?: string;
}

export interface Observation {
  step: Step;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface AgentSummary {
  intent: string;
  plan: Plan;
  observations: Observation[];
  approved: boolean;
  finalResult?: unknown;
  error?: string;
  totalSteps: number;
  completedSteps: number;
}

/**
 * Tool descriptor for the agent's tool registry.
 */
export interface ToolDescriptor {
  name: string;
  description: string;
  approvalLevel: ApprovalLevel;
  isHighRisk: boolean;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}
