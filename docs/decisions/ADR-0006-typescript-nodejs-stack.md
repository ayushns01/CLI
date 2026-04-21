# ADR-0006: TypeScript and Node.js as the Primary Implementation Stack

## Status

Accepted

## Context

The initial draft plan assumed a Go-first implementation. After reviewing the product shape, that choice would have split the platform across multiple primary languages:

- Go for the CLI and execution layer
- TypeScript for the future web dashboard
- JavaScript or TypeScript for much of the AI integration surface

Because ChainMind is a CLI-first product that also needs an agent runtime, shared domain logic, and a web companion, a single-language stack is more valuable than optimizing only for a single-binary CLI.

## Decision

ChainMind will use TypeScript and Node.js as the primary implementation stack.

Initial framework direction:

- `oclif` for the CLI
- `viem` for EVM interaction
- SQLite for local persistence
- Next.js for the web companion
- Vitest for automated tests

## Consequences

- CLI, agent runtime, shared packages, and web surfaces can share one language and many domain modules.
- AI integration becomes simpler because orchestration, tool definitions, and application code live in the same ecosystem.
- The project gives up some of the deployment simplicity and binary ergonomics of a Go-first CLI.
- OS keychain access should be isolated behind a platform adapter so the rest of the codebase stays independent of any one Node-native binding strategy.
