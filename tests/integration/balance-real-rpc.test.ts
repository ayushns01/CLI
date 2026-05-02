/**
 * Integration test for the real balance tool wired to a live public RPC.
 *
 * Hits Sepolia and Base Sepolia public endpoints. Skips silently if the
 * network is unreachable so CI without internet does not break.
 *
 * Set CHAINMIND_SKIP_NETWORK=1 to force-skip locally.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createRealToolRegistry } from "../../packages/agent/src/tools.ts";
import { createChainRegistry, loadBuiltInChains } from "../../packages/chains/src/index.ts";

const SKIP_NETWORK = process.env.CHAINMIND_SKIP_NETWORK === "1";

// vitalik.eth — guaranteed to have a non-zero history on Sepolia
const TEST_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

function buildRegistry() {
  const chainRegistry = createChainRegistry(loadBuiltInChains());
  return createRealToolRegistry({ chainRegistry });
}

test("balance tool: returns real balance from sepolia public RPC", { skip: SKIP_NETWORK }, async () => {
  const registry = buildRegistry();
  const tool = registry.getTool("balance");
  assert.ok(tool, "balance tool must be registered");

  try {
    const result = await tool.execute({ chainKey: "sepolia", address: TEST_ADDRESS }) as {
      chainKey: string;
      address: string;
      balance: string;
      formatted: string;
    };

    assert.equal(result.chainKey, "sepolia");
    assert.equal(result.address, TEST_ADDRESS);
    assert.match(result.balance, /^\d+$/, "balance must be a numeric wei string");
    assert.match(result.formatted, /ETH/, "formatted balance must include the symbol");
  } catch (err) {
    if (err instanceof Error && /fetch|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(err.message)) {
      console.log(`[skip] network unreachable: ${err.message}`);
      return;
    }
    throw err;
  }
});

test("balance tool: returns real balance from base-sepolia public RPC", { skip: SKIP_NETWORK }, async () => {
  const registry = buildRegistry();
  const tool = registry.getTool("balance");
  assert.ok(tool);

  try {
    const result = await tool.execute({ chainKey: "base-sepolia", address: TEST_ADDRESS }) as {
      chainKey: string;
      balance: string;
      formatted: string;
    };

    assert.equal(result.chainKey, "base-sepolia");
    assert.match(result.balance, /^\d+$/);
    assert.match(result.formatted, /ETH/);
  } catch (err) {
    if (err instanceof Error && /fetch|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(err.message)) {
      console.log(`[skip] network unreachable: ${err.message}`);
      return;
    }
    throw err;
  }
});

test("balance tool: rejects unknown chain", async () => {
  const registry = buildRegistry();
  const tool = registry.getTool("balance");
  assert.ok(tool);

  await assert.rejects(
    () => tool.execute({ chainKey: "totally-not-a-chain", address: TEST_ADDRESS }),
    /Unsupported chain/
  );
});
