# Wallet and Security Layer

## Purpose

Protect signing authority while allowing practical developer workflows.

## Responsibilities

- keychain integration
- hardware wallet support
- Safe workflows
- approval prompts and policy evaluation
- session-scoped permissions
- sensitive action logging

## Trust Model

- keys are external or protected assets, not general application data
- the agent may request a signature but cannot self-authorize it
- different environments may carry different policy rules

## Permission Classes

- read
- simulate
- sign
- broadcast
- admin actions such as upgrades or ownership changes

## Required Controls

- transaction preview before sign
- explicit approval for risky writes
- audit trail for sensitive actions
- redaction for secrets in logs and memory

## Common Failure Modes

- unsupported signer
- rejected approval
- expired session scope
- policy mismatch
- missing hardware or Safe connectivity
