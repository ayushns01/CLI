# ChainMind Threat Model

## Scope

This document focuses on the risks introduced by a system that can plan, simulate, sign, broadcast, and monitor on-chain developer workflows.

## Protected Assets

- wallet credentials and signing authority
- contract admin privileges
- deployment environments
- workspace secrets and config
- execution logs and traces
- shared team context in later phases

## Trust Boundaries

- between the user and the agent runtime
- between the agent runtime and deterministic execution core
- between local storage and external providers
- between approval UI surfaces and actual signing flows
- between local mode and future team mode

## Assumptions

- model output is not trusted by default
- external RPCs and explorer APIs may be incorrect, unavailable, or malicious
- users can make mistakes under time pressure
- CI environments require different controls than local development machines

## Primary Threats

### 1. Unsafe AI Action Proposals

Risk:
The model suggests an incorrect chain, contract method, recipient, or value transfer.

Mitigations:

- deterministic validation before execution
- transaction previews with decoded details
- simulation-before-broadcast for risky writes
- explicit approval gates

### 2. Secret Exposure

Risk:
Private keys or sensitive tokens are exposed through local files, logs, prompts, or crashes.

Mitigations:

- OS keychain by default
- hardware wallet support
- redact secrets from logs
- avoid raw-key storage on disk by default

### 3. Policy Bypass

Risk:
An agent-run workflow performs actions outside the intended scope.

Mitigations:

- session-scoped permissions
- per-action policy evaluation
- chain and wallet allowlists
- audit logging for sensitive operations

### 4. Provider Misinformation or Instability

Risk:
A bad RPC or explorer response causes wrong simulation, stale reads, or confusing results.

Mitigations:

- provider benchmarking and failover
- confidence reporting where results depend on third-party APIs
- provider-specific error classification

### 5. Team Mode Privilege Drift

Risk:
Shared registries, CI jobs, or collaborative agents gain excessive permissions over time.

Mitigations:

- explicit role boundaries
- approval policies tied to environment
- auditable task execution history
- separate local and team trust models

## Sensitive Actions

These actions require elevated friction and detailed logging:

- signing transactions
- broadcasting transactions
- proxy upgrades
- ownership transfers
- Safe proposals and execution
- environment promotion in CI/CD

## Security Principles

- read, simulate, sign, and broadcast are separate risk classes
- preview before sign
- simulate before broadcast when feasible
- never let model output directly control signing
- every sensitive action leaves an audit trail

## Open Security Questions

- Which policy defaults should be hard-coded versus configurable?
- How much automation should be allowed in hosted or team mode?
- What minimum audit data must be retained for later forensic use?
