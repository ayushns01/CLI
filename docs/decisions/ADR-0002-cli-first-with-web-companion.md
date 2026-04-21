# ADR-0002: CLI-First Control Plane with Web Companion

## Status

Accepted

## Context

The product needs both terminal speed and richer visual inspection surfaces. Treating CLI and web as equal from day one would slow the foundation and complicate the execution model.

## Decision

The primary control plane is the CLI and TUI. A later first-class web companion will extend visibility, collaboration, and inspection.

## Consequences

- Deterministic execution APIs must remain usable without the web surface.
- Early design work prioritizes command and terminal workflows.
- Web features should consume shared platform services rather than create separate execution logic.
