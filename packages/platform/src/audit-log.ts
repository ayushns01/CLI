import { randomUUID } from "node:crypto";

import type { AuditRecord } from "../../memory/src/models.ts";
import { SqliteWorkspaceStore } from "../../memory/src/sqlite-store.ts";
import type { AuditFilter } from "../../memory/src/sqlite-store.ts";
import type { EvaluationResult } from "./policy.ts";

export type { AuditFilter };

export interface AuditSummary {
  total: number;
  allowed: number;
  denied: number;
  byEnv: Record<string, number>;
}

export class AuditLogger {
  private store: SqliteWorkspaceStore;
  private env: string;

  constructor(store: SqliteWorkspaceStore, env: string) {
    this.store = store;
    this.env = env;
  }

  /** Throws if the underlying store write fails. */
  log(actorId: string, action: string, result: EvaluationResult, metadata?: Record<string, unknown>): void {
    const record: AuditRecord = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      actorId,
      action,
      env: this.env,
      allowed: result.allowed,
      reason: result.reason,
      metadata: metadata !== undefined ? JSON.stringify(metadata) : undefined
    };
    this.store.saveAuditRecord(record);
  }

  list(filter?: AuditFilter): AuditRecord[] {
    return this.store.listAuditRecords(filter);
  }

  summary(): AuditSummary {
    const records = this.list();
    let allowed = 0;
    let denied = 0;
    const byEnv: Record<string, number> = {};

    for (const record of records) {
      if (record.allowed) {
        allowed++;
      } else {
        denied++;
      }
      byEnv[record.env] = (byEnv[record.env] ?? 0) + 1;
    }

    return {
      total: records.length,
      allowed,
      denied,
      byEnv
    };
  }
}
