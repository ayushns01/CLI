# ChainMind Delivery Roadmap

## Roadmap Philosophy

The project is designed as a full platform, but it must be delivered in layers so each phase produces a coherent and testable system.

## Phase 0: Foundation

Scope:

- repository structure
- config model
- chain registry
- RPC manager
- wallet and keychain support
- base CLI scaffolding
- SQLite persistence
- logging and execution record model

Exit criteria:

- local config can resolve chains and wallets
- deterministic execution primitives exist without AI
- core data model is stable enough to support later modules

## Phase 1: Core Developer Workflows

Scope:

- artifact ingestion
- contract deployment
- contract verification
- read and write interaction flows
- contract studio
- calldata encode and decode helpers
- transaction previews
- simulation pipeline

Exit criteria:

- a developer can deploy and interact with a contract end to end
- actions can be previewed and logged
- artifacts and deployed addresses persist in workspace state

## Phase 2: Debugging and Analysis

Scope:

- trace retrieval
- revert explanation pipeline
- decoded logs and calldata views
- gas inspection
- local fork workflows with Anvil
- static analysis tool integration

Exit criteria:

- failed transactions can be inspected through one workflow
- fork-based reproduction is possible for supported cases
- analysis results are available in both human and structured formats

## Phase 3: Agent Runtime

Scope:

- natural-language intent parsing
- planner and tool orchestration
- memory retrieval
- approval-aware execution loops
- response synthesis
- AI regression fixtures

Exit criteria:

- common workflows can be requested in natural language
- the agent respects the same deterministic execution boundaries as explicit commands
- policy-denied actions are explained clearly

## Phase 4: Monitoring and Automation

Scope:

- wallet and contract watchers
- scheduled checks
- event-driven alerts
- bounded follow-up actions
- audit-friendly automation history

Exit criteria:

- recurring developer workflows can run under explicit policy
- alerts and runs are persisted and inspectable

## Phase 5: Team and CI/CD

Scope:

- shared workspace model
- project registry
- CI entry points
- environment-aware policies
- audit trails for team actions
- Postgres-backed state for collaboration

Exit criteria:

- multiple users or systems can share project state safely
- CI deploy and inspection workflows use the same execution core

## Phase 6: Web Companion

Scope:

- dashboard surfaces
- run history
- trace viewers
- registry exploration
- monitoring panels
- team visibility and collaboration aids

Exit criteria:

- the web app improves visibility and collaboration without becoming a required dependency for local execution

## Cross-Cutting Work

The following concerns span every phase:

- policy and approvals
- observability
- testing and regression coverage
- backward compatibility of stored state
- documentation upkeep
