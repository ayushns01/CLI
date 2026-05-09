# ChainMind

ChainMind is an EVM developer workstation for the command line. It replaces the tab-switching between Etherscan, wallet extensions, RPC dashboards, and deploy scripts with one tool that handles the full workflow — from checking balances to deploying across ten chains at once.

## Install

```bash
npm install -g chainmind
```

Requires Node.js 20+. Uses `viem` under the hood. No API keys required for core commands.

## Quick Start

```bash
# Check balance
chainmind balance --chain sepolia --address 0xYourAddress

# Estimate gas
chainmind gas estimate --chain ethereum --from 0x... --to 0x... --data 0x

# Simulate a transaction before signing
chainmind simulate --chain base --from 0x... --to 0x... --data 0x

# Deploy a contract
chainmind deploy --chain sepolia --artifact ./out/Token.json --private-key 0x... --confirm-broadcast

# Deploy to multiple chains at once
chainmind deploy --chain sepolia,base-sepolia,arbitrum-sepolia \
  --artifact ./out/Token.json --private-key 0x... --confirm-broadcast

# Auto-verify after deploy (requires ETHERSCAN_API_KEY)
chainmind deploy --chain sepolia --artifact ./out/Token.json \
  --private-key 0x... --confirm-broadcast \
  --verify --source ./src/Token.sol --name Token --compiler v0.8.20+commit.a1b79de6

# Verify a previously deployed contract
chainmind verify --chain sepolia --address 0x1234... \
  --source ./src/Token.sol --name Token --compiler v0.8.20+commit.a1b79de6

# Trace any transaction
chainmind trace --chain ethereum --tx 0xYourTxHash

# Fork a chain locally for debugging
chainmind fork --chain mainnet --port 8545

# Interactive workstation (arrow keys, no flags needed)
chainmind
```

## Interactive Mode

Running `chainmind` with no arguments opens a full interactive workstation. Navigate with arrow keys, press Enter to select.

For deploy, a multi-select chain picker lets you toggle multiple chains on/off before broadcasting:

```
Select chains to deploy to  (↑↓ move  space toggle  enter confirm)

❯ [✓] sepolia
  [✓] base-sepolia
  [ ] arbitrum-sepolia
  [ ] optimism-sepolia
```

## Supported Chains

| Chain | Key | Verifier |
|-------|-----|----------|
| Ethereum | `ethereum` | Etherscan |
| Base | `base` | Basescan |
| Arbitrum One | `arbitrum` | Arbiscan |
| Optimism | `optimism` | Optimistic Etherscan |
| Polygon | `polygon` | Polygonscan |
| Sepolia | `sepolia` | Etherscan Sepolia |
| Base Sepolia | `base-sepolia` | Basescan Sepolia |
| Arbitrum Sepolia | `arbitrum-sepolia` | Arbiscan Sepolia |
| Optimism Sepolia | `optimism-sepolia` | Optimism Sepolia |

Custom chains and RPC overrides are configured in `.chainmind.yaml`.

## Configuration

Create a `.chainmind.yaml` in your project root:

```yaml
rpcOverrides:
  ethereum:
    - https://your-alchemy-endpoint.g.alchemy.com/v2/key
  sepolia:
    - https://your-alchemy-endpoint.g.alchemy.com/v2/key

chainAliases:
  mainnet: ethereum
  l2: base

environments:
  prod:
    rpcOverrides:
      ethereum:
        - https://prod-rpc.example.com
```

Switch environments with `CHAINMIND_ENV=prod chainmind deploy ...`

## Commands

| Command | Description |
|---------|-------------|
| `balance` | Native balance for an address on a specific chain |
| `allbal` | Scan all testnets for an address balance |
| `gas estimate` | Preview gas cost before sending |
| `simulate` | Dry-run a transaction — see success/revert and state changes |
| `trace` | Decode a transaction's full call tree |
| `deploy` | Deploy a contract from a compiled artifact or raw bytecode |
| `verify` | Verify source code on Etherscan-compatible explorers |
| `send` | Send native ETH to any address or ENS name |
| `transfer` | Transfer an ERC-20 token to any address or ENS name |
| `address add` | Save a named address to the local address book |
| `address list` | List all saved addresses |
| `address get` | Look up a saved address by name |
| `address remove` | Remove an address from the book |
| `fork` | Spin up a local Anvil fork of any supported chain |
| `monitor start` | Start the background monitoring engine |

## Sending ETH and Tokens

Send native ETH or any ERC-20 token with a single command. ENS names are resolved automatically — no need to look up addresses first.

```bash
# Send ETH
chainmind send --chain ethereum \
  --to vitalik.eth --value 0.01 \
  --private-key 0x... --confirm-broadcast

# Transfer an ERC-20 token
chainmind transfer --chain base \
  --token 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --to friend.eth --amount 100 \
  --private-key 0x... --confirm-broadcast
```

The interactive TUI shows a wallet preview (derived from the private key) and a transaction summary box before asking for confirmation.

## Address Book

Save frequently used addresses locally so you never have to paste a hex address again. Any command that accepts an address also accepts a saved name.

```bash
# Save addresses
chainmind address add treasury 0x1234...abcd
chainmind address add usdc 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum

# Use a name anywhere an address is accepted
chainmind balance --chain ethereum --address treasury
chainmind transfer --chain ethereum --token usdc --to treasury --amount 500 \
  --private-key 0x... --confirm-broadcast

# Manage the book
chainmind address list
chainmind address get treasury
chainmind address remove treasury
```

Addresses are stored locally in SQLite — no account or cloud sync required.

## Multi-Chain Deploy

Deploy the same contract to any number of chains in a single command. Results are shown per-chain:

```
Multi-chain deploy: Token
──────────────────────────────────────────────────────────────
  ✓  sepolia           0x1234...abcd  tx: 0xabc...
  ✓  base-sepolia      0x1234...abcd  tx: 0xdef...
  ✗  arbitrum-sepolia  failed: insufficient funds
──────────────────────────────────────────────────────────────
Deployed: 2/3 chains
```

## Contract Verification

After a successful deploy, pass `--verify` to automatically submit source code to the chain's block explorer (Etherscan, Basescan, Arbiscan, etc.) and poll until verified.

Requires:
- `ETHERSCAN_API_KEY` environment variable (free at [etherscan.io](https://etherscan.io/apis))
- `--source` path to the flat `.sol` file
- `--compiler` full version string (e.g. `v0.8.20+commit.a1b79de6`)

## Architecture

| Package | Responsibility |
|---------|---------------|
| `apps/cli` | CLI entrypoint, command routing, interactive TUI |
| `packages/chains` | Chain registry, metadata, RPC URLs, verifier endpoints |
| `packages/config` | `.chainmind.yaml` loading and environment resolution |
| `packages/rpc` | RPC manager and provider benchmarking |
| `packages/wallet` | Wallet storage, signers, session scopes |
| `packages/tx` | Calldata encoding, gas estimation, simulation, broadcast |
| `packages/contracts` | Artifact ingestion, deploy, verification, contract studio |
| `packages/debug` | Transaction tracing, revert decoding, Anvil fork runner |
| `packages/memory` | SQLite workspace state and run history |
| `packages/agent` | Intent parsing, planner, tool registry, approval gates |
| `packages/monitor` | Scheduler, watchers, alerts, policy runner |
| `packages/platform` | Policies, audit logs, team-mode services |

## Status

210 tests passing. All core commands are wired to real viem RPC clients.

| Area | Status |
|------|--------|
| Core commands (balance, gas, simulate, trace, deploy) | ✅ |
| Multi-chain deploy | ✅ |
| Contract verification (Etherscan-compatible) | ✅ |
| Interactive TUI with arrow-key navigation | ✅ |
| Artifact-based deploy (Hardhat + Foundry JSON) | ✅ |
| Send ETH and ERC-20 transfers | ✅ |
| ENS name resolution | ✅ |
| Local address book | ✅ |
| Local fork debugging (Anvil) | ✅ |
| Workspace memory and run history | ✅ |
| Background monitoring engine | ✅ |
| Agent runtime scaffolding | ✅ |

## Guiding Principles

- AI proposes, deterministic systems execute.
- Read, simulate, sign, and broadcast are distinct permission levels.
- Local-first defaults — no cloud dependency for core workflows.
- Every sensitive action requires explicit confirmation before broadcast.
- Multi-chain is a core concern, not an afterthought.
