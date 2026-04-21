# Debug and Analysis Engine

## Purpose

Help developers understand what happened, why it happened, and what to do next.

## Responsibilities

- retrieve and render transaction traces
- decode calldata and logs
- explain reverts in plain language
- compare simulation and live execution
- support local fork reproduction
- integrate static analysis tools
- provide gas and event inspection

## Inputs

- tx hashes
- receipts
- traces
- ABIs and source metadata
- local fork context

## Outputs

- structured trace data
- summarized failure reports
- AI explanations
- reproducible debugging artifacts

## Design Notes

- raw trace visibility must remain available to advanced users
- AI explanations should cite the concrete evidence they are based on
- debugging output should be usable in both CLI and web surfaces
