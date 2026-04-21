# Chain Execution Engine

## Purpose

Provide the deterministic blockchain execution layer for all read, simulate, sign, and broadcast operations.

## Responsibilities

- resolve chain metadata
- benchmark and select RPC providers
- build calldata and transactions
- estimate gas
- manage nonce strategy
- simulate writes where supported
- sign transactions after approval
- broadcast transactions and collect receipts

## Key Subcomponents

- chain registry
- RPC manager
- tx builder
- gas and nonce manager
- simulation adapter
- broadcaster

## Inputs

- execution plan steps
- wallet context
- chain and contract metadata
- policy constraints

## Outputs

- read results
- simulation reports
- signed payloads
- receipts and explorer links
- structured execution errors

## Design Rules

- expose consistent interfaces across supported chains
- classify provider failures cleanly
- separate simulation from signing and broadcasting
- keep execution logic usable without the AI layer
