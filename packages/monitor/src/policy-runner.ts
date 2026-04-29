/**
 * Policy-aware follow-up action runner for monitoring alerts.
 *
 * When a watcher fires an alert the PolicyRunner evaluates the configured
 * follow-up actions against the current ApprovalPolicy before executing them
 * through the shared ToolRegistry. This mirrors the agent runtime approval
 * model but applies it deterministically to monitoring-triggered actions.
 *
 * Bounds enforced:
 *   - At most MAX_FOLLOW_UP_ACTIONS per alert.
 *   - High-risk tools are never executed when denyHighRisk is set.
 *   - Each action must clear the approval gate (or autoApprove must be on).
 */

import type { SqliteWorkspaceStore } from "../../memory/src/sqlite-store.ts";
import type { AlertRecord } from "../../memory/src/models.ts";
import type { ToolRegistry } from "../../agent/src/tools.ts";
import type { ApprovalPolicy } from "../../agent/src/types.ts";

export interface FollowUpAction {
  tool: string;
  args: Record<string, unknown>;
}

export interface PolicyRunResult {
  alertId: string;
  actionsAttempted: number;
  actionsCompleted: number;
  denied: boolean;
  error?: string;
}

export type FollowUpApprovalGate = (
  action: FollowUpAction,
  policy: ApprovalPolicy
) => Promise<boolean>;

const MAX_FOLLOW_UP_ACTIONS = 3;

export class PolicyRunner {
  private readonly toolRegistry: ToolRegistry;
  private readonly policy: ApprovalPolicy;
  private readonly store: SqliteWorkspaceStore;
  private readonly approvalGate: FollowUpApprovalGate | undefined;

  constructor(
    toolRegistry: ToolRegistry,
    policy: ApprovalPolicy,
    store: SqliteWorkspaceStore,
    approvalGate?: FollowUpApprovalGate
  ) {
    this.toolRegistry = toolRegistry;
    this.policy = policy;
    this.store = store;
    this.approvalGate = approvalGate;
  }

  /**
   * Execute bounded follow-up actions for a fired alert.
   * Persists the alert, runs approved actions, then marks it resolved.
   */
  async handleAlert(
    alert: AlertRecord,
    actions: FollowUpAction[]
  ): Promise<PolicyRunResult> {
    // Persist the incoming alert
    this.store.saveAlert(alert);

    // Check for high-risk actions if policy denies them
    if (this.policy.denyHighRisk) {
      const hasHighRisk = actions.some((a) => {
        const tool = this.toolRegistry.getTool(a.tool);
        return tool?.isHighRisk ?? false;
      });
      if (hasHighRisk) {
        return {
          alertId: alert.id,
          actionsAttempted: 0,
          actionsCompleted: 0,
          denied: true,
          error: "Follow-up contains high-risk tool — denied by policy"
        };
      }
    }

    const bounded = actions.slice(0, MAX_FOLLOW_UP_ACTIONS);
    let completed = 0;

    for (const action of bounded) {
      const tool = this.toolRegistry.getTool(action.tool);
      if (!tool) continue;

      const approved = await this.approveAction(action);
      if (!approved) continue;

      try {
        await tool.execute(action.args);
        completed++;
      } catch {
        // individual tool failure does not abort remaining actions
      }
    }

    // Mark resolved regardless of how many actions succeeded
    this.store.resolveAlert(alert.id);

    return {
      alertId: alert.id,
      actionsAttempted: bounded.length,
      actionsCompleted: completed,
      denied: false
    };
  }

  private async approveAction(action: FollowUpAction): Promise<boolean> {
    if (this.policy.autoApprove) return true;
    if (this.approvalGate) return this.approvalGate(action, this.policy);
    return false;
  }
}
