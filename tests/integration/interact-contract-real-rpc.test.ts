/**
 * Integration tests for interact_contract wired to viem Contract reads/writes.
 *
 * Read tests use public RPC and skip when the network is unavailable.
 * Write tests are opt-in because they consume testnet gas:
 *   CHAINMIND_ENABLE_BROADCAST_TESTS=1
 *   CHAINMIND_DEPLOY_PRIVATE_KEY=<funded-testnet-key>
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createRealToolRegistry } from "../../packages/agent/src/tools.ts";
import { createChainRegistry, loadBuiltInChains } from "../../packages/chains/src/index.ts";

const SKIP_NETWORK = process.env.CHAINMIND_SKIP_NETWORK === "1";
const ENABLE_BROADCAST = process.env.CHAINMIND_ENABLE_BROADCAST_TESTS === "1";
const DEPLOY_PRIVATE_KEY = process.env.CHAINMIND_DEPLOY_PRIVATE_KEY;
const WETH_SEPOLIA_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const TEST_SPENDER = "0x0000000000000000000000000000000000000001";

const WETH_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
];

function buildRegistry() {
  const chainRegistry = createChainRegistry(loadBuiltInChains());
  return createRealToolRegistry({ chainRegistry });
}

test("interact_contract: reads name() from Sepolia WETH", { skip: SKIP_NETWORK }, async () => {
  const tool = buildRegistry().getTool("interact_contract");
  assert.ok(tool);

  try {
    const result = await tool.execute({
      chainKey: "sepolia",
      address: WETH_SEPOLIA_ADDRESS,
      abi: JSON.stringify(WETH_ABI),
      functionName: "name",
      args: []
    }) as { chainKey: string; address: string; functionName: string; result: unknown };

    assert.equal(result.chainKey, "sepolia");
    assert.equal(result.address, WETH_SEPOLIA_ADDRESS);
    assert.equal(result.functionName, "name");
    assert.equal(typeof result.result, "string");
    assert.match(result.result, /ether/i);
  } catch (err) {
    if (err instanceof Error && /fetch|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(err.message)) {
      console.log(`[skip] network unreachable: ${err.message}`);
      return;
    }
    throw err;
  }
});

test("interact_contract: rejects missing address before hitting RPC", async () => {
  const tool = buildRegistry().getTool("interact_contract");
  assert.ok(tool);

  await assert.rejects(
    () =>
      tool.execute({
        chainKey: "sepolia",
        abi: WETH_ABI,
        functionName: "name",
        args: []
      }),
    /interact_contract requires a address arg/
  );
});

test("interact_contract: rejects unknown chain", async () => {
  const tool = buildRegistry().getTool("interact_contract");
  assert.ok(tool);

  await assert.rejects(
    () =>
      tool.execute({
        chainKey: "totally-not-a-chain",
        address: WETH_SEPOLIA_ADDRESS,
        abi: WETH_ABI,
        functionName: "name",
        args: []
      }),
    /Unsupported chain/
  );
});

test("interact_contract: rejects unknown function name", async () => {
  const tool = buildRegistry().getTool("interact_contract");
  assert.ok(tool);

  await assert.rejects(
    () =>
      tool.execute({
        chainKey: "sepolia",
        address: WETH_SEPOLIA_ADDRESS,
        abi: WETH_ABI,
        functionName: "doesNotExist",
        args: []
      }),
    /Function doesNotExist not found in ABI/
  );
});

test("interact_contract: writes to testnet contract when explicitly enabled", {
  skip: SKIP_NETWORK || !ENABLE_BROADCAST || !DEPLOY_PRIVATE_KEY
}, async () => {
  const tool = buildRegistry().getTool("interact_contract");
  assert.ok(tool);

  try {
    const result = await tool.execute({
      chainKey: "sepolia",
      address: WETH_SEPOLIA_ADDRESS,
      abi: WETH_ABI,
      functionName: "approve",
      args: [TEST_SPENDER, "0"],
      privateKey: DEPLOY_PRIVATE_KEY
    }) as {
      chainKey: string;
      txHash: string;
      blockNumber: string;
    };

    assert.equal(result.chainKey, "sepolia");
    assert.match(result.txHash, /^0x[0-9a-fA-F]{64}$/);
    assert.match(result.blockNumber, /^\d+$/);
  } catch (err) {
    if (err instanceof Error && /fetch|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(err.message)) {
      console.log(`[skip] network unreachable: ${err.message}`);
      return;
    }
    throw err;
  }
});
