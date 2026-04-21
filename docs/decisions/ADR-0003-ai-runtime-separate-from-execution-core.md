# ADR-0003: Separate AI Runtime from Deterministic Execution Core

## Status

Accepted

## Context

The platform needs AI-assisted planning and explanation, but direct model-driven execution creates safety, testing, and maintainability problems.

## Decision

ChainMind will separate the agent runtime from the deterministic execution core. The runtime may propose steps, but only validated deterministic components may perform chain actions.

## Consequences

- Safety boundaries become clearer and more testable.
- Explicit commands and AI requests can share one execution substrate.
- Model providers can change without rewriting blockchain execution logic.
