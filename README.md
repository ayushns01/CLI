# ChainMind

ChainMind is an internal design-stage project for a developer-only, AI-native on-chain workstation for EVM teams.

The product vision is simple: a developer should be able to plan, deploy, interact with, simulate, debug, monitor, and automate smart contract workflows from one system instead of juggling explorers, wallet extensions, RPC dashboards, scripts, and separate CI glue.

## Status

This repository contains the architecture and decision package for the full project plus the first implementation slice: a zero-dependency TypeScript monorepo bootstrap and base CLI skeleton.

## Implementation Direction

The current implementation choice is:

- TypeScript and Node.js for the CLI, runtime, shared platform packages, and agent layer
- `viem` for EVM interaction
- `oclif` for the CLI command framework
- SQLite for local-first persistence
- Next.js for the web companion
- Vitest for automated testing

This replaces the earlier Go-first assumption in the initial draft planning notes.

For the current bootstrap phase, the repo uses:

- npm workspaces instead of `pnpm`, because `pnpm` is not installed in the local environment yet
- Node 25's `--experimental-strip-types` support to run `.ts` files without a transpile step
- Node's built-in test runner for the first CLI smoke test

This keeps the initial scaffold dependency-light while preserving the TypeScript-first direction.

## Product Definition

ChainMind is:

- an AI-aware developer workstation, not just a thin CLI wrapper
- a deterministic execution platform with an agent runtime on top
- a developer tool for EVM builders and teams
- a CLI-first system with a later first-class web companion

ChainMind is not:

- a retail trading product
- a consumer wallet replacement
- an unsupervised autonomous fund manager
- an excuse to let LLM output bypass execution safety controls

## Core Jobs

- Turn natural language or explicit commands into safe, reviewable on-chain workflows
- Deploy, verify, upgrade, and interact with contracts across chains
- Simulate and explain transaction outcomes before money moves
- Diagnose failed transactions with traces, decoded calldata, and plain-English reasoning
- Persist project context so repeated workflows get faster over time
- Support background monitoring, automation, CI/CD, and later team collaboration

## Documentation Map

- [Master design spec](docs/superpowers/specs/2026-04-20-chainmind-design.md)
- [Product overview](docs/product.md)
- [System architecture](docs/architecture.md)
- [Threat model](docs/threat-model.md)
- [Delivery roadmap](docs/roadmap.md)
- [Module docs](docs/modules/)
- [Architecture decision records](docs/decisions/)

## Document Set

The docs are intentionally layered:

1. `README.md` orients a new internal reader quickly.
2. The master design spec captures the full-project definition in one place.
3. Architecture and product docs explain the platform from different angles.
4. Module docs define boundaries and responsibilities.
5. ADRs record the important choices that should not be rediscovered later.

## Guiding Principles

- AI proposes, deterministic systems execute.
- Read, simulate, sign, and broadcast are distinct permission levels.
- Local-first defaults reduce cost, latency, and operational risk.
- Every sensitive action must be inspectable after the fact.
- Multi-chain support is a core platform concern, not a plugin afterthought.
- The CLI remains the primary control plane even after the web companion ships.
