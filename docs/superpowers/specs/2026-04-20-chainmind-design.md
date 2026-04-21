# ChainMind Design Spec

Date: 2026-04-20
Status: Drafted for internal review
Audience: Internal engineering and product planning

## 1. Executive Summary

ChainMind is a developer-only, AI-native on-chain workstation for EVM teams. It combines a CLI-first interface, an agent runtime, a deterministic chain execution core, and platform services for deployment, debugging, monitoring, and collaboration.

The core promise is that an engineer can complete most day-to-day on-chain development workflows from one system:

- plan actions in natural language or explicit commands
- deploy and verify contracts
- interact with deployed contracts safely
- simulate writes before signing
- debug failed transactions and explain why they failed
- persist project context and reuse it later
- automate recurring developer operations

This project is intentionally broader than an MVP. The documentation package describes the entire platform destination while preserving a phased path to delivery.

## 2. Problem Statement

EVM development workflows are fragmented. Developers routinely switch between:

- Hardhat or Foundry
- block explorers
- wallet extensions
- RPC providers and dashboards
- ABI encoders and decoders
- CI pipelines
- local scripts and notebooks
- issue trackers and deployment notes

This context switching slows iteration, increases operator error, and makes debugging harder than it should be. Existing tools usually handle only one slice of the workflow at a time.

ChainMind solves this by combining:

- a single control plane
- reusable workspace context
- safe action planning
- deterministic execution
- observability and debugging
- background monitoring and automation

## 3. Product Definition

ChainMind is:

- an AI-assisted developer workstation
- a CLI-first EVM engineering platform
- a system for deploy, interact, simulate, debug, monitor, and automate workflows
- a local-first product with an optional collaborative platform layer later

ChainMind is not:

- a retail wallet
- a trading terminal
- a DeFi strategy engine for end users
- a product that allows raw model output to sign or broadcast transactions directly

### North Star

A developer should be able to manage most EVM build, deploy, debug, and contract-ops workflows from ChainMind without bouncing between many disconnected tools.

## 4. Goals and Non-Goals

### Goals

- Provide a unified interface for common EVM developer workflows
- Make AI useful by attaching it to safe deterministic tools
- Improve debugging quality through traces, simulation, and explanation
- Preserve memory across sessions at the workspace level
- Support later team and CI/CD workflows without rewriting the core
- Standardize on one implementation language across CLI, agent runtime, shared services, and web

### Non-Goals

- Building a retail-first DeFi assistant
- Supporting every non-EVM chain in the first architecture pass
- Treating the web dashboard as required for local developer workflows
- Allowing broad autonomous execution without policy boundaries

## 4.1 Implementation Stack Direction

ChainMind should be implemented primarily in TypeScript and Node.js.

Recommended building blocks:

- `oclif` for the CLI command model
- `viem` for EVM access and contract interactions
- SQLite for local-first persistence
- Next.js for the web companion
- Vitest for testing

This stack choice optimizes for one shared language across:

- CLI and optional TUI surfaces
- the agent runtime
- shared domain packages
- the future web companion

It also reduces the coordination cost that would come from mixing a Go backend with a TypeScript web and AI layer.

## 5. System Architecture

ChainMind is organized in layers:

1. Interface layer
   CLI, TUI, web companion, and CI entry points.
2. Agent runtime
   Intent parsing, planning, memory usage, tool orchestration, approvals, and result synthesis.
3. Deterministic execution core
   Chain registry, RPC selection, wallet handling, transaction building, simulation, signing, and broadcast.
4. Developer services
   Contract lifecycle, debugging, analysis, monitoring, automation, and workspace support.
5. Persistence and platform services
   Local storage, team storage, policy rules, audit logs, and shared project state.

The critical architectural rule is:

**AI decides what to attempt; deterministic systems decide how the action is performed safely.**

See [architecture.md](../../architecture.md) for the expanded system view.

## 6. Core Modules

### Agent Runtime

Handles intent parsing, plan generation, tool invocation, memory lookups, approval checkpoints, and explanation of outcomes.

### Chain Execution Engine

Handles multi-chain configuration, RPC routing, calldata creation, gas estimation, nonce management, simulation, signing, broadcasting, and receipts.

### Wallet and Security Layer

Handles OS keychain integration, hardware wallets, Safe flows, scoped permissions, and transaction previews.

### Contract Lifecycle Suite

Handles artifact ingestion, compile and deploy flows, verification, upgrades, and contract studio interactions.

### Debug and Analysis Engine

Handles traces, revert explanations, decoded events and calldata, gas analysis, forks, and static analysis integrations.

### Monitoring and Automation Engine

Handles background jobs, wallet and contract watchers, alerts, scheduled tasks, and follow-up actions under policy.

### Workspace and Team Layer

Handles project config, address books, shared registries, environments, CI integrations, and collaborative state later.

### Web Companion

Provides dashboards and inspection surfaces without replacing the CLI as the primary control plane.

See the `docs/modules/` directory for per-module design notes.

## 7. Runtime Flow

The default request flow is:

1. A user submits a task through CLI, TUI, web, or CI.
2. The interface normalizes the request into a structured task object.
3. The agent runtime loads workspace context, known contracts, wallet labels, chain defaults, policies, and recent execution history.
4. The runtime classifies the request type, such as deploy, interact, simulate, debug, or monitor.
5. The planner creates an explicit multi-step execution plan.
6. The policy layer checks the plan against permission boundaries.
7. The deterministic execution core resolves the chain, selects RPC, builds and optionally simulates actions, then signs or broadcasts only if allowed.
8. Observations flow back into the runtime after each step.
9. The renderer produces human-readable output plus machine-usable structured results.
10. The persistence layer stores the execution record, artifacts, traces, and updated memory.

This model supports two main operating styles:

- guided mode, where the user approves sensitive actions
- automation mode, where pre-approved policies permit bounded tasks

## 8. Safety Model

Safety is a platform feature, not just a security note.

### Principles

- Never store raw private keys on disk by default.
- Separate read, simulate, sign, and broadcast permissions.
- Always show transaction previews before sensitive actions.
- Default to simulate-before-broadcast when feasible.
- Use session-scoped permissions for agent-led workflows.
- Log sensitive actions for later audit.
- Treat all model output as untrusted until validated by the deterministic layer.

### Implications

- AI cannot directly sign or broadcast transactions.
- Contract upgrades, fund transfers, and privileged calls require higher-friction approvals.
- Team mode needs stronger policy and audit boundaries than local mode.

See [threat-model.md](../../threat-model.md) for the expanded threat analysis.

## 9. Delivery Strategy

The whole project is decomposed into phases:

- Phase 0: Foundation
- Phase 1: Core developer workflows
- Phase 2: Debugging and analysis
- Phase 3: Agent runtime
- Phase 4: Monitoring and automation
- Phase 5: Team and CI/CD
- Phase 6: Web companion

See [roadmap.md](../../roadmap.md) for scope, dependencies, and exit criteria per phase.

## 10. Major Decisions Already Locked

- ChainMind is developer-only in scope.
- The primary control plane is the CLI, with a later first-class web companion.
- The AI runtime is separated from the deterministic execution core.
- Local-first storage starts with SQLite and expands to Postgres for team mode.
- Approval policies and session-scoped permissions are first-class design constraints.
- The primary implementation stack is TypeScript and Node.js rather than Go.

See the ADRs in [docs/decisions](../../decisions/).

## 11. Operational Expectations

### Failure Handling

Failures must be structured and explainable:

- network and RPC errors
- simulation mismatch
- revert and trace failures
- verification failures
- policy denials
- signing rejection
- unsupported network or artifact issues

The system must always return:

- what failed
- where it failed
- what had already been attempted
- the safest likely next step

### Observability

Every run should produce inspectable logs covering:

- input intent
- generated plan
- tools used
- provider chosen
- warnings and approvals
- final outputs
- tx hashes, receipts, explorer links, or traces when applicable

### Testing

The system needs:

- unit tests for deterministic modules
- integration tests for chain interactions
- end-to-end tests for full workflows
- AI regression tests for tool selection and policy boundaries

## 12. Open Questions

- How much of the web companion must exist before team mode is genuinely useful?
- How should model-provider abstraction be structured so prompt and tool behavior can evolve safely?
- Which policy defaults should be opinionated versus fully configurable?
- What is the right boundary between local automation and hosted background services?

## 13. Documentation Map

- [README](../../../README.md)
- [Product overview](../../product.md)
- [System architecture](../../architecture.md)
- [Threat model](../../threat-model.md)
- [Roadmap](../../roadmap.md)
- [Module docs](../../modules/)
- [Decision records](../../decisions/)
