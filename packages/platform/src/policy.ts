import type { ApprovalLevel, ApprovalPolicy } from "../../agent/src/types.ts";

export type Environment = "local" | "ci" | "team";
export type RequiredLevel = "none" | "read" | "write" | "sign" | "broadcast";

export interface PlatformPolicy {
  env: Environment;
  requiredLevel: RequiredLevel;
  autoApprove?: boolean;
  denyHighRisk?: boolean;
  allowedActions?: string[];   // empty = all actions allowed
}

export interface EvaluationResult {
  allowed: boolean;
  reason?: string;
}

const LEVEL_ORDER: RequiredLevel[] = ["none", "read", "write", "sign", "broadcast"];

function levelIndex(level: RequiredLevel): number {
  return LEVEL_ORDER.indexOf(level);
}

export class PolicyEvaluator {
  private policy: PlatformPolicy;

  constructor(policy: PlatformPolicy) {
    this.policy = policy;
  }

  evaluate(action: string, level: RequiredLevel): EvaluationResult {
    // Step 1: check allowedActions
    if (this.policy.allowedActions && this.policy.allowedActions.length > 0) {
      if (!this.policy.allowedActions.includes(action)) {
        return { allowed: false, reason: "action not in allowlist" };
      }
    }

    // Step 2: compute effective denyHighRisk (baseline overrides)
    // (used for toApprovalPolicy; evaluate focuses on level blocking)

    // Step 3: check if level is blocked by environment
    const env = this.policy.env;
    if (env === "ci") {
      if (level === "sign" || level === "broadcast") {
        return { allowed: false, reason: "level blocked in ci environment" };
      }
    }

    // Step 4: requiredLevel "none" → always allowed
    if (this.policy.requiredLevel === "none") {
      return { allowed: true };
    }

    // Step 5: level ordering check
    const requiredIdx = levelIndex(this.policy.requiredLevel);
    const requestedIdx = levelIndex(level);
    if (requiredIdx > requestedIdx) {
      return { allowed: false, reason: "insufficient approval level" };
    }

    return { allowed: true };
  }

  toApprovalPolicy(): ApprovalPolicy {
    // Map RequiredLevel → ApprovalLevel
    const levelMap: Record<RequiredLevel, ApprovalLevel> = {
      none: "none",
      read: "read",
      write: "simulate",
      sign: "sign",
      broadcast: "broadcast"
    };

    const requiredLevel: ApprovalLevel = levelMap[this.policy.requiredLevel];

    // Compute effective denyHighRisk based on environment baseline
    let denyHighRisk: boolean;
    const env = this.policy.env;
    if (env === "ci") {
      // CI always forces denyHighRisk = true, regardless of caller
      denyHighRisk = true;
    } else if (env === "team") {
      // team forces denyHighRisk = true unless caller explicitly set false
      denyHighRisk = this.policy.denyHighRisk !== false;
    } else {
      // local: use caller's setting, defaulting to false
      denyHighRisk = this.policy.denyHighRisk ?? false;
    }

    const autoApprove = this.policy.autoApprove ?? false;

    return {
      requiredLevel,
      autoApprove,
      denyHighRisk
    };
  }
}
