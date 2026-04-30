# Task 12: Platform Policies, Audit Logs, and Web Companion

> **For agentic workers:** Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to implement this task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the ChainMind platform with two deliverables:
1. `packages/platform/` — environment-aware policy evaluation and an immutable SQLite audit log
2. `apps/web/` — a Next.js companion dashboard that surfaces run history, traces, registry, and monitoring data from the existing memory store

**Status of prior tasks:** Tasks 1–11 are implemented and merged. The deterministic core, agent runtime, and monitoring engine are all functional with 120 passing tests.

**Tech stack constraints:**
- Same monorepo, npm workspaces, `node --experimental-strip-types`, Node built-in test runner
- No TypeScript parameter properties in constructors (strip-only mode limitation — use explicit field declarations)
- `packages/platform` tests use `node:test` + `node:assert/strict`
- `apps/web` uses Next.js 15 + React 19 + Vitest for component tests
- All platform state persists via `packages/memory` (`SqliteWorkspaceStore`)
- No real RPC, signer, or network calls in unit tests — inject interfaces

---

## Package: `packages/platform`

### Files to create

- `packages/platform/package.json`
- `packages/platform/src/policy.ts`
- `packages/platform/src/audit-log.ts`
- `packages/platform/src/index.ts`
- `packages/platform/src/platform.test.ts`

---

### Step 1: Create `packages/platform/package.json`

```json
{
  "name": "@chainmind/platform",
  "version": "0.1.0",
  "private": true,
  "type": "module"
}
```

---

### Step 2: Write failing platform tests

- [ ] Create `packages/platform/src/platform.test.ts`

Cover all of the following:

**PolicyEvaluator tests (15)**
- evaluates `local` env: allows read + write, allows high-risk with explicit override
- evaluates `ci` env: allows read, blocks write by default, blocks high-risk always
- evaluates `team` env: respects `requiredLevel` field, blocks high-risk when `denyHighRisk` is set
- `evaluate()` returns `{ allowed: true }` when policy passes
- `evaluate()` returns `{ allowed: false, reason: string }` when policy blocks
- CI env auto-sets `denyHighRisk = true` even if caller omits it
- custom rule overrides base environment defaults
- `toApprovalPolicy()` converts `PlatformPolicy` → `ApprovalPolicy` (compatible with agent runtime)
- unknown environment defaults to the most restrictive profile
- `requiredLevel: "none"` always passes in any environment
- `requiredLevel: "sign"` blocked in `ci` env
- `requiredLevel: "broadcast"` blocked in both `ci` and `team` envs unless explicitly unlocked
- environment key is case-insensitive
- policy with `autoApprove: true` still respects `denyHighRisk`
- evaluating an undefined action type defaults to `allowed: false`

**AuditLogger tests (15)**
- `log()` persists an `AuditRecord` to the store
- `log()` sets `id` (uuid-style), `timestamp`, `actorId`, `action`, `env`, `allowed`, `metadata`
- `list()` returns all records in reverse-chronological order
- `list({ actorId })` filters by actor
- `list({ env })` filters by environment
- `list({ allowed: false })` returns only denied actions
- `list({ action })` filters by action type
- `list({ since })` returns only records after a given ISO timestamp
- denied actions are logged even when `allowed: false`
- `summary()` returns `{ total, allowed, denied, byEnv: Record<string, number> }`
- `summary()` counts correctly across mixed allowed/denied records
- store persistence: records survive store re-instantiation (read back from SQLite)
- `log()` is synchronous-safe (multiple rapid calls don't lose records)
- `log()` accepts optional `metadata: Record<string, unknown>` payload
- records are immutable once written (no update/delete API exposed)

Run and confirm: `node --experimental-strip-types --test packages/platform/src/platform.test.ts`
Expected: **FAIL** (all tests fail — implementation does not exist yet)

---

### Step 3: Implement `packages/platform/src/policy.ts`

```typescript
/**
 * Environment-aware policy evaluator.
 *
 * Layered on top of the agent ApprovalPolicy, PlatformPolicy adds
 * environment context (local / ci / team) so the same codebase can
 * apply stricter rules in CI without touching agent-level config.
 *
 * Environment defaults:
 *   local — permissive: reads + writes allowed, high-risk requires explicit flag
 *   ci    — restrictive: reads only, high-risk always denied
 *   team  — moderate: reads + writes, high-risk denied unless unlocked
 */
```

**Exports:**
```typescript
export type Environment = "local" | "ci" | "team";
export type RequiredLevel = "none" | "read" | "write" | "sign" | "broadcast";

export interface PlatformPolicy {
  env: Environment;
  requiredLevel: RequiredLevel;
  autoApprove?: boolean;
  denyHighRisk?: boolean;
  allowedActions?: string[];   // explicit allowlist, empty = all
}

export interface EvaluationResult {
  allowed: boolean;
  reason?: string;
}

export class PolicyEvaluator {
  // explicit field declarations (no parameter properties)
  private readonly policy: PlatformPolicy;

  constructor(policy: PlatformPolicy) {
    this.policy = policy;
  }

  evaluate(action: string, level: RequiredLevel): EvaluationResult
  toApprovalPolicy(): ApprovalPolicy   // imported from packages/agent/src/types.ts
}
```

**Environment baseline rules** (applied before caller overrides):
- `ci`: force `denyHighRisk = true`, block `sign` and `broadcast` levels
- `team`: force `denyHighRisk = true` unless caller explicitly sets `denyHighRisk: false`
- `local`: no forced overrides

---

### Step 4: Implement `packages/platform/src/audit-log.ts`

```typescript
/**
 * Immutable audit logger.
 *
 * Every policy evaluation result is optionally persisted here so
 * security-sensitive actions are traceable after the fact.
 * Records are append-only — there is no update or delete API.
 */
```

**Extend `packages/memory/src/models.ts`** with:
```typescript
export interface AuditRecord {
  id: string;
  timestamp: string;          // ISO-8601
  actorId: string;
  action: string;
  env: string;
  allowed: boolean;
  reason?: string;
  metadata?: string;          // JSON-serialised Record<string, unknown>
}
```

**Extend `packages/memory/src/sqlite-store.ts`** with:
- `audit` table migration (id, timestamp, actorId, action, env, allowed, reason, metadata)
- `saveAuditRecord(record: AuditRecord): void`
- `listAuditRecords(filter?: AuditFilter): AuditRecord[]`

**`AuditLogger` class:**
```typescript
export interface AuditFilter {
  actorId?: string;
  env?: string;
  allowed?: boolean;
  action?: string;
  since?: string;   // ISO-8601
}

export interface AuditSummary {
  total: number;
  allowed: number;
  denied: number;
  byEnv: Record<string, number>;
}

export class AuditLogger {
  private readonly store: SqliteWorkspaceStore;
  private readonly env: string;

  constructor(store: SqliteWorkspaceStore, env: string) { ... }

  log(actorId: string, action: string, result: EvaluationResult, metadata?: Record<string, unknown>): void
  list(filter?: AuditFilter): AuditRecord[]
  summary(): AuditSummary
}
```

---

### Step 5: Create `packages/platform/src/index.ts`

Re-export everything from `policy.ts` and `audit-log.ts`.

---

### Step 6: Re-run platform tests

Run: `node --experimental-strip-types --test packages/platform/src/platform.test.ts`
Expected: **PASS** (all 30 tests green)

---

## App: `apps/web`

### Files to create

- `apps/web/package.json`
- `apps/web/next.config.ts`
- `apps/web/tsconfig.json`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/runs/page.tsx`
- `apps/web/src/app/traces/page.tsx`
- `apps/web/src/app/registry/page.tsx`
- `apps/web/src/app/monitoring/page.tsx`
- `apps/web/src/lib/store.ts`
- `apps/web/src/app/page.test.tsx`
- `tests/e2e/team-mode.test.ts`

---

### Step 7: Create `apps/web/package.json`

```json
{
  "name": "@chainmind/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vitest": "^2.0.0",
    "jsdom": "^25.0.0"
  }
}
```

---

### Step 8: Write failing web tests

- [ ] Create `apps/web/src/app/page.test.tsx`

Cover:

**Home page (3)**
- renders "ChainMind" heading
- renders navigation links to all 4 sections (runs, traces, registry, monitoring)
- renders current date/environment badge

**Runs page (3)**
- renders "Run History" heading
- renders empty state when no runs exist
- renders run rows with id, command, timestamp, status columns

**Traces page (2)**
- renders "Debug Traces" heading
- renders empty state when no traces exist

**Registry page (2)**
- renders "Contract Registry" heading
- renders empty state when no contracts are deployed

**Monitoring page (2)**
- renders "Monitoring" heading
- renders empty state when no watchers are active

Run: `cd apps/web && npx vitest run`
Expected: **FAIL**

---

### Step 9: Write failing e2e team-mode tests

- [ ] Create `tests/e2e/team-mode.test.ts`

Cover:

**PolicyEvaluator e2e (4)**
- CI policy blocks broadcast in end-to-end evaluation chain
- local policy allows broadcast when level is satisfied
- team policy blocks high-risk tool execution
- `toApprovalPolicy()` output is accepted by the agent `PlanExecutor`

**AuditLogger e2e (4)**
- full round-trip: log → persist → list → verify fields
- denied CI action appears in `list({ allowed: false })`
- `summary()` reflects correct counts after mixed log entries
- audit records survive process restart (store re-open)

**Platform + Monitor integration (4)**
- `PolicyRunner` respects platform policy when `denyHighRisk` is elevated by CI env
- audit logger captures monitor follow-up action results
- team env blocks sign-level actions in the approval gate
- `toApprovalPolicy()` correctly bridges platform and agent layers

Run: `node --experimental-strip-types --test tests/e2e/team-mode.test.ts`
Expected: **FAIL**

---

### Step 10: Implement the web companion pages

#### `apps/web/src/lib/store.ts`
Server-side helper that opens a read-only view of the workspace SQLite store and exposes typed fetch functions used by Next.js server components:
- `getRuns(limit?: number): RunRecord[]`
- `getAlerts(limit?: number): AlertRecord[]`
- `getContracts(): DeployedContractRecord[]`

#### `apps/web/src/app/layout.tsx`
Root layout with:
- `<html>`, `<body>`
- `<nav>` with links: Overview · Runs · Traces · Registry · Monitoring
- minimal inline CSS (no external CSS framework dependency)

#### `apps/web/src/app/page.tsx`
Overview dashboard:
- "ChainMind" heading, environment badge, last-updated timestamp
- stat cards: total runs, active watchers, deployed contracts, recent alerts

#### `apps/web/src/app/runs/page.tsx`
Run history table:
- columns: Run ID (truncated), Command, Status, Started, Duration
- empty state: "No runs recorded yet"
- rows sorted newest-first

#### `apps/web/src/app/traces/page.tsx`
Debug traces list:
- columns: Tx Hash (truncated), Chain, Revert Reason, Timestamp
- empty state: "No debug traces recorded yet"

#### `apps/web/src/app/registry/page.tsx`
Deployed contract registry:
- columns: Name, Address (truncated), Chain, Deployed At
- empty state: "No contracts deployed yet"

#### `apps/web/src/app/monitoring/page.tsx`
Monitoring status:
- active watchers count
- recent alerts table: Watcher ID, Type, Message, Severity, Triggered At
- empty state: "No monitoring alerts yet"

---

### Step 11: Re-run all web and e2e tests

Run: `cd apps/web && npx vitest run`
Expected: **PASS** (12 component tests green)

Run: `node --experimental-strip-types --test tests/e2e/team-mode.test.ts`
Expected: **PASS** (12 e2e tests green)

---

## Root `package.json` updates

- [ ] Add `"test:platform"` script:
  ```
  node --experimental-strip-types --test packages/platform/src/platform.test.ts tests/e2e/team-mode.test.ts
  ```
- [ ] Add `packages/platform/src/platform.test.ts` and `tests/e2e/team-mode.test.ts` to the main `"test"` script

---

## Final verification

Run the full suite:
```
npm test
```
Expected: **all tests pass** (120 prior + 30 platform unit + 12 platform e2e + 12 web component = ~174 passing)

---

## Definition of done

- [ ] `packages/platform/src/policy.ts` — `PolicyEvaluator` with environment-aware rules and `toApprovalPolicy()`
- [ ] `packages/platform/src/audit-log.ts` — append-only `AuditLogger` backed by SQLite
- [ ] `packages/memory/src/models.ts` — `AuditRecord` type added
- [ ] `packages/memory/src/sqlite-store.ts` — audit table + CRUD methods added
- [ ] `apps/web/` — Next.js 15 companion with 5 pages (overview, runs, traces, registry, monitoring)
- [ ] 30 unit tests in `packages/platform/src/platform.test.ts` — all green
- [ ] 12 e2e tests in `tests/e2e/team-mode.test.ts` — all green
- [ ] 12 component tests in `apps/web/src/app/page.test.tsx` — all green
- [ ] Root `package.json` test scripts updated
- [ ] Full `npm test` passes
