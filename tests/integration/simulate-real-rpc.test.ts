/**
 * Integration test for simulate_tx wired to a live public RPC.
 *
 * Hits Sepolia and Base Sepolia. Skips silently on network failure.
 * Set CHAINMIND_SKIP_NETWORK=1 to force-skip locally.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createRealToolRegistry } from "../../packages/agent/src/tools.ts";
import { createChainRegistry, loadBuiltInChains } from "../../packages/chains/src/index.ts";

const SKIP_NETWORK = process.env.CHAINMIND_SKIP_NETWORK === "1";

const FROM = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; // vitalik.eth
const TO = "0x0000000000000000000000000000000000000000";

function buildRegistry() {
  const chainRegistry = createChainRegistry(loadBuiltInChains());
  return createRealToolRegistry({ chainRegistry });
}

test("simulate_tx: zero-value transfer simulates successfully on sepolia", { skip: SKIP_NETWORK }, async () => {
  const tool = buildRegistry().getTool("simulate_tx");
  assert.ok(tool);

  try {
    const result = await tool.execute({
      chainKey: "sepolia",
      from: FROM,
      to: TO,
      data: "0x",
      valueWei: "0"
    }) as { success: boolean; chainKey: string; gasUsed?: string; revertReason?: string };

    if (!result.success) {
      throw new Error(`simulation failed: ${result.revertReason}`);
    }
    assert.equal(result.chainKey, "sepolia");
    assert.equal(result.success, true);
    assert.match(result.gasUsed!, /^\d+$/, "gasUsed must be a numeric string");
    assert.ok(BigInt(result.gasUsed!) > 0n, "gasUsed must be > 0");
  } catch (err) {
    if (err instanceof Error && /fetch|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(err.message)) {
      console.log(`[skip] network unreachable: ${err.message}`);
      return;
    }
    throw err;
  }
});

test("simulate_tx: zero-value transfer simulates successfully on base-sepolia", { skip: SKIP_NETWORK }, async () => {
  const tool = buildRegistry().getTool("simulate_tx");
  assert.ok(tool);

  try {
    const result = await tool.execute({
      chainKey: "base-sepolia",
      from: FROM,
      to: TO,
      data: "0x",
      valueWei: "0"
    }) as { success: boolean; chainKey: string; gasUsed?: string };

    assert.equal(result.chainKey, "base-sepolia");
    assert.equal(result.success, true);
    assert.match(result.gasUsed!, /^\d+$/);
  } catch (err) {
    if (err instanceof Error && /fetch|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(err.message)) {
      console.log(`[skip] network unreachable: ${err.message}`);
      return;
    }
    throw err;
  }
});

test("simulate_tx: rejects unknown chain", async () => {
  const tool = buildRegistry().getTool("simulate_tx");
  assert.ok(tool);

  await assert.rejects(
    () => tool.execute({ chainKey: "totally-not-a-chain", from: FROM, to: TO, data: "0x", valueWei: "0" }),
    /Unsupported chain/
  );
});
