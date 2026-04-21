# ChainMind Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ChainMind as a CLI-first, AI-native EVM developer workstation in TypeScript/Node.js, with a deterministic `w3cli`-style core first and the agent layer added only after the core is stable.

**Architecture:** ChainMind should be implemented as a TypeScript monorepo. Shared domain packages handle chains, RPCs, wallets, contracts, transactions, debugging, memory, policies, and the agent runtime; the CLI and web app both consume those packages instead of reimplementing logic in separate stacks.

**Tech Stack:** TypeScript, Node.js, pnpm workspaces, oclif, viem, SQLite, Vitest, Next.js, Anvil, Slither

---

## Proposed File Structure

- `package.json`
  Root workspace scripts and shared dependencies.
- `pnpm-workspace.yaml`
  Monorepo package layout.
- `tsconfig.base.json`
  Shared TypeScript config.
- `vitest.workspace.ts`
  Shared test configuration.
- `apps/cli/package.json`
  CLI package manifest.
- `apps/cli/src/index.ts`
  CLI entrypoint.
- `apps/cli/src/commands/`
  oclif command modules.
- `packages/config/src/`
  Config loading and `.chainmind.yaml` support.
- `packages/chains/src/`
  Chain registry and network metadata.
- `packages/rpc/src/`
  RPC benchmarking, health scoring, and provider selection.
- `packages/wallet/src/`
  Wallet labels, keychain adapters, signer abstractions, session scopes.
- `packages/contracts/src/`
  Artifact loading, deploy flows, verification, contract studio helpers.
- `packages/tx/src/`
  Calldata helpers, gas estimation, previews, simulation, and broadcast flows.
- `packages/debug/src/`
  Trace retrieval, revert explanation inputs, fork helpers, debug reports.
- `packages/memory/src/`
  SQLite-backed workspace state and run history.
- `packages/agent/src/`
  Intent parsing, planning, tool orchestration, approval-aware execution loops.
- `packages/monitor/src/`
  Watchers, schedulers, jobs, and alerts.
- `packages/platform/src/`
  Policies, audit logs, service wiring, and shared app contracts.
- `apps/web/`
  Next.js companion dashboard.
- `tests/e2e/`
  End-to-end workflows against local forks or testnets.

## Phase Order

1. Monorepo foundation
2. Deterministic `w3cli`-style core
3. Deployment, simulation, and debugging
4. Memory and policy
5. Agentic AI runtime
6. Monitoring and automation
7. Team, CI/CD, and web companion

### Task 1: Bootstrap the TypeScript Monorepo and Base CLI

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Create: `apps/cli/package.json`
- Create: `apps/cli/src/index.ts`
- Create: `apps/cli/src/commands/root.ts`
- Test: `apps/cli/src/commands/root.test.ts`

- [ ] **Step 1: Initialize the workspace**

Run: `pnpm init`
Expected: root `package.json` created

- [ ] **Step 2: Add workspace and TypeScript configuration**

Create:
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `vitest.workspace.ts`

Add root scripts for:
- `build`
- `typecheck`
- `test`
- `lint`

- [ ] **Step 3: Write the failing CLI smoke test**

Create `apps/cli/src/commands/root.test.ts` with a test that asserts the root command renders help text.

- [ ] **Step 4: Run the smoke test to verify failure**

Run: `pnpm exec vitest run apps/cli/src/commands/root.test.ts`
Expected: FAIL because the root CLI command is not implemented yet

- [ ] **Step 5: Implement the base CLI**

Create:
- `apps/cli/src/index.ts`
- `apps/cli/src/commands/root.ts`

Use `oclif` and add placeholder command groups:
- `wallet`
- `chain`
- `contract`
- `tx`
- `debug`
- `agent`
- `monitor`

- [ ] **Step 6: Re-run the smoke test**

Run: `pnpm exec vitest run apps/cli/src/commands/root.test.ts`
Expected: PASS

- [ ] **Step 7: Run baseline verification**

Run: `pnpm test`
Expected: PASS

### Task 2: Add Config Loading and Chain Registry

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/src/index.ts`
- Create: `packages/config/src/config.test.ts`
- Create: `packages/chains/package.json`
- Create: `packages/chains/src/index.ts`
- Create: `packages/chains/src/registry.test.ts`
- Create: `configs/chains/mainnet.json`
- Create: `configs/chains/testnet.json`

- [ ] **Step 1: Write failing config tests**

Cover:
- loading local config
- resolving default chain aliases
- preparing for `.chainmind.yaml` parsing later

- [ ] **Step 2: Write failing chain registry tests**

Cover:
- lookup by chain name
- lookup by chain ID
- unsupported chain errors

- [ ] **Step 3: Run targeted tests**

Run: `pnpm exec vitest run packages/config/src/config.test.ts packages/chains/src/registry.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement config and chain registry**

Support:
- built-in chain metadata
- explorer URLs
- native token symbols
- testnet/mainnet markers

- [ ] **Step 5: Re-run targeted tests**

Run: `pnpm exec vitest run packages/config/src/config.test.ts packages/chains/src/registry.test.ts`
Expected: PASS

### Task 3: Build Wallet Storage, Signer Abstractions, and Session Scopes

**Files:**
- Create: `packages/wallet/package.json`
- Create: `packages/wallet/src/keychain.ts`
- Create: `packages/wallet/src/signer.ts`
- Create: `packages/wallet/src/session-scope.ts`
- Create: `packages/wallet/src/wallet.test.ts`
- Modify: `apps/cli/src/commands/root.ts`

- [ ] **Step 1: Write failing wallet tests**

Cover:
- saving a wallet label
- resolving a wallet by label
- handling unknown labels

- [ ] **Step 2: Write failing scope tests**

Cover:
- read-only scope
- simulate scope
- sign scope
- broadcast scope
- chain out-of-scope rejection

- [ ] **Step 3: Run wallet tests**

Run: `pnpm exec vitest run packages/wallet/src/wallet.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement wallet abstractions**

Add:
- OS keychain adapter interface
- labeled wallet storage
- signer abstraction for future hardware wallet and Safe support

- [ ] **Step 5: Implement session-scoped permissions**

Support:
- `read`
- `simulate`
- `sign`
- `broadcast`

- [ ] **Step 6: Re-run wallet tests**

Run: `pnpm exec vitest run packages/wallet/src/wallet.test.ts`
Expected: PASS

### Task 4: Implement RPC Manager and Provider Benchmarking

**Files:**
- Create: `packages/rpc/package.json`
- Create: `packages/rpc/src/manager.ts`
- Create: `packages/rpc/src/benchmark.ts`
- Create: `packages/rpc/src/manager.test.ts`

- [ ] **Step 1: Write failing provider-selection tests**

Cover:
- fastest healthy provider wins
- unhealthy provider is skipped
- read-only retry path works

- [ ] **Step 2: Run RPC tests**

Run: `pnpm exec vitest run packages/rpc/src/manager.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement RPC selection**

Include:
- latency scoring
- health tracking
- fallback ordering
- structured timeout and rate-limit errors

- [ ] **Step 4: Re-run RPC tests**

Run: `pnpm exec vitest run packages/rpc/src/manager.test.ts`
Expected: PASS

### Task 5: Deliver the `w3cli`-Style Core Commands

**Files:**
- Create: `packages/tx/package.json`
- Create: `packages/tx/src/balance.ts`
- Create: `packages/tx/src/calldata.ts`
- Create: `packages/tx/src/gas.ts`
- Create: `packages/tx/src/sign-message.ts`
- Create: `packages/tx/src/core.test.ts`
- Create: `apps/cli/src/commands/balance.ts`
- Create: `apps/cli/src/commands/allbal.ts`
- Create: `apps/cli/src/commands/calldata/encode.ts`
- Create: `apps/cli/src/commands/calldata/decode.ts`
- Create: `apps/cli/src/commands/gas/estimate.ts`
- Create: `apps/cli/src/commands/sign-message.ts`
- Test: `tests/e2e/core-commands.test.ts`

- [ ] **Step 1: Write failing deterministic-core tests**

Cover:
- single-chain balance lookup
- multi-chain balance aggregation
- calldata encode and decode
- gas estimation
- message signing

- [ ] **Step 2: Run unit and e2e tests**

Run: `pnpm exec vitest run packages/tx/src/core.test.ts tests/e2e/core-commands.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the first real command set**

Ship:
- `chainmind balance`
- `chainmind allbal --testnet`
- `chainmind calldata encode`
- `chainmind calldata decode`
- `chainmind gas estimate`
- `chainmind sign-message`

Use `viem` for chain access, calldata work, and client behavior.

- [ ] **Step 4: Re-run unit and e2e tests**

Run: `pnpm exec vitest run packages/tx/src/core.test.ts tests/e2e/core-commands.test.ts`
Expected: PASS

### Task 6: Build Artifact Ingestion, ERC-20 Deploy, and Generic Contract Deploy

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/src/artifact-loader.ts`
- Create: `packages/contracts/src/deployer.ts`
- Create: `packages/contracts/src/verify.ts`
- Create: `packages/contracts/src/contracts.test.ts`
- Create: `apps/cli/src/commands/token/deploy.ts`
- Create: `apps/cli/src/commands/contract/deploy.ts`
- Test: `tests/e2e/deploy-contract.test.ts`

- [ ] **Step 1: Write failing artifact-loading tests**

Cover:
- Hardhat artifact parsing
- Foundry artifact parsing
- missing ABI or bytecode failure

- [ ] **Step 2: Write failing deployment tests**

Cover:
- constructor argument encoding
- chain selection
- receipt parsing
- saved deployment metadata

- [ ] **Step 3: Run contract tests**

Run: `pnpm exec vitest run packages/contracts/src/contracts.test.ts tests/e2e/deploy-contract.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement artifact ingestion and deployment**

Support:
- ERC-20 deploy shortcut
- generic artifact deploy
- saved deployment output

- [ ] **Step 5: Implement the first verification adapter**

Target one explorer backend first and hide it behind an abstraction.

- [ ] **Step 6: Re-run contract tests**

Run: `pnpm exec vitest run packages/contracts/src/contracts.test.ts tests/e2e/deploy-contract.test.ts`
Expected: PASS

### Task 7: Add Contract Studio, Previews, and Simulation

**Files:**
- Create: `packages/contracts/src/studio.ts`
- Create: `packages/tx/src/preview.ts`
- Create: `packages/tx/src/simulate.ts`
- Create: `packages/tx/src/simulate.test.ts`
- Create: `apps/cli/src/commands/contract/studio.ts`
- Test: `tests/e2e/contract-interaction.test.ts`

- [ ] **Step 1: Write failing interaction tests**

Cover:
- ABI-driven read calls
- write-call argument parsing
- preview rendering

- [ ] **Step 2: Write failing simulation tests**

Cover:
- simulate-before-broadcast
- decoded revert reason output
- simulation mismatch handling

- [ ] **Step 3: Run interaction tests**

Run: `pnpm exec vitest run packages/tx/src/simulate.test.ts tests/e2e/contract-interaction.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement studio and simulation flows**

Support:
- interactive contract calls
- preview before sign
- simulate-before-send for risky writes

- [ ] **Step 5: Re-run interaction tests**

Run: `pnpm exec vitest run packages/tx/src/simulate.test.ts tests/e2e/contract-interaction.test.ts`
Expected: PASS

### Task 8: Build Trace, Fork, and Debug Workflows

**Files:**
- Create: `packages/debug/package.json`
- Create: `packages/debug/src/trace.ts`
- Create: `packages/debug/src/revert-explainer-input.ts`
- Create: `packages/debug/src/fork.ts`
- Create: `packages/debug/src/debug.test.ts`
- Create: `apps/cli/src/commands/trace.ts`
- Create: `apps/cli/src/commands/fork.ts`
- Test: `tests/e2e/debug-tx.test.ts`

- [ ] **Step 1: Write failing debug tests**

Cover:
- trace retrieval by tx hash
- decoded call stack output
- local fork startup and teardown

- [ ] **Step 2: Run debug tests**

Run: `pnpm exec vitest run packages/debug/src/debug.test.ts tests/e2e/debug-tx.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement trace and fork workflows**

Ship:
- `chainmind trace <txHash>`
- `chainmind fork <network>`
- structured inputs for future AI failure explanation

- [ ] **Step 4: Re-run debug tests**

Run: `pnpm exec vitest run packages/debug/src/debug.test.ts tests/e2e/debug-tx.test.ts`
Expected: PASS

### Task 9: Add Workspace Memory, Run History, and `.chainmind.yaml`

**Files:**
- Create: `packages/memory/package.json`
- Create: `packages/memory/src/sqlite-store.ts`
- Create: `packages/memory/src/models.ts`
- Create: `packages/memory/src/memory.test.ts`
- Modify: `packages/config/src/index.ts`

- [ ] **Step 1: Write failing persistence tests**

Cover:
- saved wallets
- saved contract metadata
- run history
- preferred chains

- [ ] **Step 2: Run memory tests**

Run: `pnpm exec vitest run packages/memory/src/memory.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement SQLite-backed memory**

Persist:
- wallets
- contracts
- environments
- execution history
- user preferences

- [ ] **Step 4: Add `.chainmind.yaml` workspace parsing**

Support:
- project defaults
- known addresses
- chain aliases
- environment profiles

- [ ] **Step 5: Re-run memory tests**

Run: `pnpm exec vitest run packages/memory/src/memory.test.ts`
Expected: PASS

### Task 10: Introduce the Agentic AI Runtime

**Files:**
- Create: `packages/agent/package.json`
- Create: `packages/agent/src/runtime.ts`
- Create: `packages/agent/src/planner.ts`
- Create: `packages/agent/src/tools.ts`
- Create: `packages/agent/src/provider.ts`
- Create: `packages/agent/src/agent.test.ts`
- Create: `apps/cli/src/commands/ai.ts`
- Test: `tests/e2e/agent-workflows.test.ts`

- [ ] **Step 1: Write failing intent-to-plan tests**

Cover:
- deploy request
- balance request
- contract interaction request
- denied high-risk request

- [ ] **Step 2: Write failing orchestration tests**

Cover:
- multi-step plan execution order
- observation loop after each tool
- policy denial propagation

- [ ] **Step 3: Run agent tests**

Run: `pnpm exec vitest run packages/agent/src/agent.test.ts tests/e2e/agent-workflows.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement a provider-agnostic LLM adapter**

Keep prompts and model-provider code separate from deterministic tools.

- [ ] **Step 5: Implement the runtime**

Support:
- intent parsing
- plan generation
- tool dispatch
- approval checkpoints
- structured summaries

- [ ] **Step 6: Re-run agent tests**

Run: `pnpm exec vitest run packages/agent/src/agent.test.ts tests/e2e/agent-workflows.test.ts`
Expected: PASS

### Task 11: Add Monitoring and Automation

**Files:**
- Create: `packages/monitor/package.json`
- Create: `packages/monitor/src/jobs.ts`
- Create: `packages/monitor/src/watchers.ts`
- Create: `packages/monitor/src/policy-runner.ts`
- Create: `packages/monitor/src/monitor.test.ts`
- Create: `apps/cli/src/commands/monitor/start.ts`
- Test: `tests/e2e/monitoring.test.ts`

- [ ] **Step 1: Write failing monitoring tests**

Cover:
- wallet watcher state changes
- contract event watcher triggers
- bounded follow-up action under policy

- [ ] **Step 2: Run monitoring tests**

Run: `pnpm exec vitest run packages/monitor/src/monitor.test.ts tests/e2e/monitoring.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the monitoring engine**

Ship:
- scheduler
- watcher registry
- persisted alerts
- policy-aware follow-up execution

- [ ] **Step 4: Re-run monitoring tests**

Run: `pnpm exec vitest run packages/monitor/src/monitor.test.ts tests/e2e/monitoring.test.ts`
Expected: PASS

### Task 12: Add Platform Policies, Audit Logs, and the Web Companion

**Files:**
- Create: `packages/platform/package.json`
- Create: `packages/platform/src/policy.ts`
- Create: `packages/platform/src/audit-log.ts`
- Create: `packages/platform/src/platform.test.ts`
- Create: `apps/web/package.json`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/runs/page.tsx`
- Create: `apps/web/src/app/traces/page.tsx`
- Create: `apps/web/src/app/registry/page.tsx`
- Create: `apps/web/src/app/monitoring/page.tsx`
- Test: `apps/web/src/app/page.test.tsx`
- Test: `tests/e2e/team-mode.test.ts`

- [ ] **Step 1: Write failing policy and audit tests**

Cover:
- environment-aware permission rules
- CI-specific restrictions
- audit record creation

- [ ] **Step 2: Write failing web tests**

Cover:
- runs page loads history
- traces page renders debug data
- registry page lists deployments

- [ ] **Step 3: Run platform and web tests**

Run: `pnpm exec vitest run packages/platform/src/platform.test.ts tests/e2e/team-mode.test.ts apps/web/src/app/page.test.tsx`
Expected: FAIL

- [ ] **Step 4: Implement platform services**

Add:
- policy evaluation
- audit logs
- team-ready shared-state abstractions
- CI/CD execution records

- [ ] **Step 5: Implement the first web companion**

Add:
- run history
- trace viewer
- registry browser
- monitoring status

- [ ] **Step 6: Re-run platform and web tests**

Run: `pnpm exec vitest run packages/platform/src/platform.test.ts tests/e2e/team-mode.test.ts apps/web/src/app/page.test.tsx`
Expected: PASS

## First Build Target

Do not start with the full platform. The first executable milestone is:

- Tasks 1 through 7 only

That milestone delivers:

- chain registry and RPC routing
- wallet labels and security scopes
- balances and utility commands
- calldata helpers
- ERC-20 and artifact deployment
- contract interaction studio
- previews and simulation

Only after that deterministic core is stable should the agent runtime begin.

## Definition of Done for the First Public Alpha

- deterministic core commands work on selected EVM testnets
- contract deploy and interaction flows work from artifacts
- simulation and previews protect risky writes
- trace and revert inspection are usable from the CLI
- local memory persists wallets, contracts, and run history
- the AI runtime can complete a small approved set of workflows safely

## Next Planning Split

This master plan should be followed by three narrower execution plans:

1. `typescript-foundation-and-core-cli`
2. `deploy-debug-and-memory`
3. `agent-runtime-monitoring-and-web`

Create those before implementation begins so execution stays focused and testable.
