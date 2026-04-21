# ChainMind Product Overview

## Mission

Build a developer-only, AI-native on-chain workstation that removes workflow fragmentation for EVM engineers and teams.

## Problem

Today's EVM developer workflow is fragmented across compilers, RPC dashboards, explorers, wallet tools, simulation tools, trace viewers, CI scripts, and ad hoc internal notes. The result is slow iteration, high context-switching cost, and preventable operational mistakes.

## Product Positioning

ChainMind is a control plane for on-chain development work.

It combines:

- explicit CLI commands
- natural-language task requests
- reusable workspace memory
- policy-aware execution
- deterministic blockchain tooling
- debugging and observability
- monitoring and automation

## Target Users

- smart contract engineers
- protocol engineers
- devops and release engineers for EVM products
- security-minded teams that need approvals and auditability

## Core Use Cases

### Build and Deploy

- ingest Hardhat or Foundry artifacts
- deploy contracts and proxies
- verify deployments on explorers
- capture resulting addresses in a registry

### Interact and Script

- read and write contract methods
- encode and decode calldata
- run scripted workflows against known environments
- inspect contract state through CLI and TUI flows

### Simulate and Debug

- preflight a transaction before signing
- trace failed transactions
- explain revert causes in plain English
- inspect logs, events, and gas behavior

### Operate and Automate

- monitor contracts and wallets
- watch for expiring tasks or unhealthy workflows
- run recurring operational checks
- integrate policy-aware deployments into CI/CD later

## Product Boundaries

ChainMind deliberately excludes:

- consumer portfolio management
- retail trading workflows
- autonomous treasury management
- unrestricted AI-led transaction broadcasting

## Experience Principles

- One system, many workflows.
- Deterministic execution beats magical opacity.
- Safe defaults are more important than frictionless danger.
- Context should accumulate instead of being re-entered every session.
- Advanced users can drop to explicit commands at any time.

## Desired Outcomes

- fewer tool-switching steps per workflow
- faster time from idea to deployment
- better debugging quality when transactions fail
- stronger auditability for team and CI workflows
- a reusable developer environment that improves over time
