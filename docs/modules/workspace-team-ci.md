# Workspace, Team, and CI Layer

## Purpose

Give projects a durable operating context that survives beyond a single command or developer machine.

## Responsibilities

- workspace configuration
- environment profiles
- shared contract registry
- address books and ABI references
- local and shared memory state
- CI entry points
- team policy surfaces later

## Core Artifact

`.chainmind.yaml` should become the project contract between local runs, team workflows, and CI.

## Modes

### Local

- single user
- SQLite-backed state
- keychain or hardware signer focus

### Team

- shared metadata and environments
- stronger access controls
- collaborative run history
- Postgres-backed state

### CI

- non-interactive workflows
- stricter policy gating
- environment promotion and audit focus

## Design Notes

- CI should reuse the same execution core as local runs
- shared state must not weaken local safety assumptions
- workspace config must remain understandable by humans
