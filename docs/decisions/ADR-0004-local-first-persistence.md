# ADR-0004: Local-First Persistence with SQLite, Expand to Postgres Later

## Status

Accepted

## Context

Early developer workflows need low-friction local state. Later team mode needs shared storage and stronger collaboration support.

## Decision

Local mode will use SQLite by default. Team and collaborative mode will add Postgres-backed shared persistence later.

## Consequences

- Early development can move quickly with minimal operational overhead.
- The data model must be portable between local and shared storage backends.
- Team features should not assume shared infrastructure exists in phase 0.
