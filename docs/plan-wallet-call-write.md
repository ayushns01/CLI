# Plan: `chainmind wallet` + `chainmind call` + `chainmind write`

## Overview

Three commands that turn ChainMind into a complete contract interaction workstation.

- **`wallet`** — store named wallets so signing commands never need a raw private key on the command line
- **`call`** — read any view/pure function from a deployed contract
- **`write`** — send a state-changing transaction to a contract function

---

## What each command does

### `chainmind wallet`

Register a label → address mapping locally. Private keys are never stored on disk — they come from environment variables at runtime. The stored address is used for display only.

```bash
# Register a wallet
chainmind wallet add deployer 0x1111111111111111111111111111111111111111

# List all registered wallets
chainmind wallet list

# Remove a wallet
chainmind wallet remove deployer

# Use --wallet in any signing command instead of --private-key
CHAINMIND_KEY_DEPLOYER=0x1111... chainmind deploy \
  --chain sepolia --artifact ./out/Token.json \
  --wallet deployer --confirm-broadcast
```

`--wallet deployer` reads the private key from `CHAINMIND_KEY_<LABEL_UPPERCASE>` at the moment of signing. Keys live in `.env`, never in shell history.

---

### `chainmind call`

Call any `view` or `pure` function on a deployed contract. No private key required.

```bash
chainmind call \
  --chain ethereum \
  --address 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --artifact ./out/Token.json \
  --fn balanceOf \
  --arg 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

Output:
```
contract: Token
function: balanceOf(address)
result:   1000000000  (uint256)
chain:    ethereum
address:  0xA0b8...48
```

Multiple `--arg` flags are supported for functions with multiple parameters. Args are automatically coerced to the correct on-chain type (address, uint256, bool, etc.) from the ABI.

---

### `chainmind write`

Send a state-changing transaction to a contract function. Requires `--confirm-broadcast`.

```bash
chainmind write \
  --chain base \
  --address 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  --artifact ./out/Token.json \
  --fn transfer \
  --arg 0xRecipient --arg 500000000 \
  --wallet deployer --confirm-broadcast
```

Output:
```
contract:    Token
function:    transfer(address, uint256)
transaction: 0xabc...def
block:       123456
chain:       base
```

---

## What already exists (nothing to rewrite)

| What | Where |
|------|-------|
| `createViemContractClient` with `read()` and `write()` | `packages/rpc/src/viem-clients.ts` |
| `buildContractReadCall`, `buildContractWriteCall` | `packages/contracts/src/studio.ts` |
| `parseContractArtifact` (Hardhat + Foundry JSON) | `packages/contracts/src/artifact-loader.ts` |
| `saveWallet`, `getWallet`, `listWallets` in SQLite | `packages/memory/src/sqlite-store.ts` |
| Arg coercion (`coerceArgs`) for all primitive ABI types | `packages/rpc/src/viem-clients.ts` |

---

## Implementation steps

### Step 1 — `apps/cli/src/commands/wallet.ts` *(new)*

Render functions only — no logic.

```typescript
export function renderWalletEntry(entry: WalletMemoryRecord): string
export function renderWalletList(entries: WalletMemoryRecord[]): string
```

`renderWalletList` outputs a columnar table (label, address, type) matching the style of `renderAddressList`.

---

### Step 2 — `apps/cli/src/commands/call.ts` *(new)*

Render functions only.

```typescript
export function renderCallResult(result: {
  contractName: string;
  functionName: string;
  inputs: AbiParameter[];
  outputs: AbiParameter[];
  result: unknown;
  chainKey: string;
  address: string;
}): string

export function renderWriteResult(result: {
  contractName: string;
  functionName: string;
  transactionHash: string;
  blockNumber: string;
  chainKey: string;
}): string
```

`renderCallResult` formats the result value with its Solidity type from the ABI output array.

---

### Step 3 — `packages/agent/src/tools.ts` *(modify)*

Add two tools to both registries.

**`call_contract`** (stub + real):
- Input: `{ chainKey, contractAddress, abi, functionName, args }`
- Picks RPC URL for the chain, calls `createViemContractClient(...).read()`
- Returns `{ contractAddress, functionName, result, resultType }`

**`write_contract`** (stub + real):
- Input: `{ chainKey, contractAddress, abi, functionName, args, privateKey, valueWei? }`
- Validates `privateKey` is present before any network call
- Calls `createViemContractClient(...).write()`
- Returns `{ transactionHash, blockNumber }`

---

### Step 4 — `packages/memory/src/sqlite-store.ts` *(modify)*

Add one missing method:

```typescript
removeWallet(label: string): boolean
// DELETE FROM wallets WHERE label = ?
// returns true if a row was deleted
```

---

### Step 5 — `apps/cli/src/router.ts` *(modify)*

**New helper — `resolvePrivateKey(options, store)`:**
```
if --private-key present  → use it directly
if --wallet present       → read process.env[CHAINMIND_KEY_<LABEL>]
                            throw if env var is not set
otherwise                 → throw "provide --private-key or --wallet"
```

**New command block — `wallet`:**

| Sub-command | What it does |
|-------------|-------------|
| `wallet add <label> <address>` | `store.saveWallet({ label, address, signerType: "local-keychain" })` |
| `wallet list` | `renderWalletList(store.listWallets())` |
| `wallet remove <label>` | `store.removeWallet(label)` |

**New command block — `call`:**
1. Parse `--chain`, `--address`, `--artifact`, `--fn`, collect all `--arg` values (ordered)
2. Load artifact with `readArtifactFile`
3. `executeTool("call_contract", { chainKey, contractAddress, abi, functionName, args })`
4. Render with `renderCallResult`

**New command block — `write`:**
1. Parse same flags as `call` plus `--value-wei` (optional)
2. Require `--confirm-broadcast`
3. Resolve private key via `resolvePrivateKey`
4. `executeTool("write_contract", { chainKey, contractAddress, abi, functionName, args, privateKey, valueWei? })`
5. Render with `renderWriteResult`

**Existing commands (`deploy`, `send`, `transfer`):**
Replace `requiredOption(options, "private-key")` with `resolvePrivateKey(options, store)` so `--wallet` works there too.

---

### Step 6 — `apps/cli/src/router.test.ts` *(modify)*

Add `saveWallet`, `listWallets`, `removeWallet` to `fakeStore()`.

New tests:

| Test | Asserts |
|------|---------|
| `wallet add` saves to store | `store.saveWallet` called with correct args |
| `wallet list` renders table | stdout contains label and address |
| `wallet remove` deletes entry | `store.removeWallet` called |
| `wallet remove` unknown label returns error | exitCode 1, stderr message |
| `call` routes to `call_contract` | correct tool args including abi and fn |
| `call` passes multiple `--arg` values in order | args array matches |
| `write` requires `--confirm-broadcast` | exitCode 1 |
| `write` routes to `write_contract` | correct tool args |
| `--wallet` resolves key from env var | privateKey in tool args matches env var value |
| `--wallet` throws when env var not set | exitCode 1, helpful message |

---

### Step 7 — `apps/cli/src/interactive.ts` *(modify)*

Add two entries to the feature select menu:

**"Call contract"** flow:
1. Select chain
2. Input: artifact path (validates file exists)
3. Input: contract address
4. Select: function name (built from `listContractFunctions(abi)`, filtered to read-only)
5. Loop: input one arg per ABI input parameter (with type shown in prompt)
6. Run command, display result

**"Write contract"** flow:
1. Select chain(s) via multi-select
2. Input: artifact path
3. Input: contract address
4. Select: function name (write functions only)
5. Loop: input one arg per parameter
6. Input: private key or wallet label
7. Show transaction preview box (contract, function, args, chain)
8. Confirm broadcast → run command

---

### Step 8 — `packages/memory/src/memory.test.ts` *(modify)*

Add tests for `removeWallet`:
- removes existing wallet, returns `true`
- returns `false` for unknown label

---

## File summary

| File | Action |
|------|--------|
| `apps/cli/src/commands/wallet.ts` | Create |
| `apps/cli/src/commands/call.ts` | Create |
| `packages/agent/src/tools.ts` | Modify — add `call_contract`, `write_contract` |
| `packages/memory/src/sqlite-store.ts` | Modify — add `removeWallet` |
| `apps/cli/src/router.ts` | Modify — wallet/call/write commands, `resolvePrivateKey`, `--wallet` in existing commands |
| `apps/cli/src/router.test.ts` | Modify — new tests, `fakeStore` update |
| `apps/cli/src/interactive.ts` | Modify — call/write flows |
| `packages/memory/src/memory.test.ts` | Modify — `removeWallet` tests |

---

## Test count target

| Now | Added | Target |
|-----|-------|--------|
| 210 | ~15 | ~225 |
