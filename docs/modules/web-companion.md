# Web Companion

## Purpose

Provide persistent visibility and collaboration surfaces without replacing the CLI as the primary control plane.

## Responsibilities

- show run history
- visualize traces and debugging artifacts
- browse contract registry entries
- display monitoring status and alerts
- expose team-oriented visibility later

## Why It Exists

Some workflows are easier to inspect visually than in a terminal:

- large traces
- monitoring panels
- run timelines
- environment and registry browsing
- collaborative review

## Constraints

- local developer workflows must still work without the web app
- the web surface must respect the same policy and audit rules as the CLI
- it should consume shared platform APIs rather than invent its own execution paths
