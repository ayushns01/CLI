/**
 * Integration test for estimate_gas wired to a live public RPC.
 *
 * Hits Sepolia and Base Sepolia. Skips silently on network failure.
 * Set CHAINMIND_SKIP_NETWORK=1 to force-skip locally.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createRealToolRegistry } from "../../packages/agent/src/tools.ts";
import { createChainRegistry, loadBuiltInChains } from "../../packages/chains/src/index.ts";

const SKIP_NETWORK = process.env.CHAINMIND_SKIP_NETWORK === "1";

const FROM = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const TO = "0x0000000000000000000000000000000000000000";

function buildRegistry() {
  const chainRegistry = createChainRegistry(loadBuiltInChains());
  return createRealToolRegistry({ chainRegistry });
}

interface GasResult {
  chainKey: string;
  gasLimit: string;
  maxFeePerGasWei: string;
  maxPriorityFeePerGasWei?: string;
  estimatedCostWei: string;
  formatted: string;
}

test("estimate_gas: returns gas limit and fee from sepolia", { skip: SKIP_NETWORK }, async () => {
  const tool = buildRegistry().getTool("estimate_gas");
  assert.ok(tool);

  try {
    const result = await tool.execute({
      chainKey: "sepolia",
      from: FROM,
      to: TO,
      data: "0x",
      valueWei: "0"
    }) as GasResult;

    assert.equal(result.chainKey, "sepolia");
    assert.match(result.gasLimit, /^\d+$/);
    assert.match(result.maxFeePerGasWei, /^\d+$/);
    assert.match(result.estimatedCostWei, /^\d+$/);
    assert.ok(BigInt(result.gasLimit) >= 21000n, "gasLimit must be at least 21000 for a transfer");
    assert.ok(BigInt(result.maxFeePerGasWei) > 0n, "maxFeePerGas must be positive");
    assert.ok(BigInt(result.estimatedCostWei) > 0n, "estimated cost must be positive");
    assert.match(result.formatted, /ETH/);
  } catch (err) {
    if (err instanceof Error && /fetch|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(err.message)) {
      console.log(`[skip] network unreachable: ${err.message}`);
      return;
    }
    throw err;
  }
});

test("estimate_gas: returns gas limit and fee from base-sepolia", { skip: SKIP_NETWORK }, async () => {
  const tool = buildRegistry().getTool("estimate_gas");
  assert.ok(tool);

  try {
    const result = await tool.execute({
      chainKey: "base-sepolia",
      from: FROM,
      to: TO,
      data: "0x",
      valueWei: "0"
    }) as GasResult;

    assert.equal(result.chainKey, "base-sepolia");
    assert.ok(BigInt(result.gasLimit) >= 21000n);
    assert.ok(BigInt(result.maxFeePerGasWei) > 0n);
  } catch (err) {
    if (err instanceof Error && /fetch|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(err.message)) {
      console.log(`[skip] network unreachable: ${err.message}`);
      return;
    }
    throw err;
  }
});

test("estimate_gas: rejects unknown chain", async () => {
  const tool = buildRegistry().getTool("estimate_gas");
  assert.ok(tool);

  await assert.rejects(
    () => tool.execute({ chainKey: "totally-not-a-chain", from: FROM, to: TO, data: "0x", valueWei: "0" }),
    /Unsupported chain/
  );
});
