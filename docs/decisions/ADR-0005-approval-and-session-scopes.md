# ADR-0005: Explicit Approval Model and Session-Scoped Permissions

## Status

Accepted

## Context

The product will support high-impact actions such as deployment, contract writes, upgrades, and later automation. A coarse approval model would either be unsafe or too frustrating.

## Decision

ChainMind will treat read, simulate, sign, and broadcast as separate permission classes and support session-scoped permissions for bounded agent workflows.

## Consequences

- Approval UX becomes a core platform feature.
- Automation can be useful without becoming unrestricted.
- Policy evaluation must be visible in local, team, and CI workflows.
