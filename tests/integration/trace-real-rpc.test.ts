/**
 * Integration test for trace_tx wired to a live public RPC.
 *
 * Receipt-derived tracing needs a known transaction hash. Set
 * CHAINMIND_TRACE_TX_HASH to run the live path. Without it, only validation
 * behavior runs so CI does not depend on a mutable public-chain fixture.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createRealToolRegistry } from "../../packages/agent/src/tools.ts";
import { createChainRegistry, loadBuiltInChains } from "../../packages/chains/src/index.ts";

const SKIP_NETWORK = process.env.CHAINMIND_SKIP_NETWORK === "1";
const TRACE_CHAIN = process.env.CHAINMIND_TRACE_CHAIN ?? "sepolia";
const TRACE_TX_HASH = process.env.CHAINMIND_TRACE_TX_HASH;

function buildRegistry() {
  const chainRegistry = createChainRegistry(loadBuiltInChains());
  return createRealToolRegistry({ chainRegistry });
}

test("trace_tx: returns receipt-derived call stack from public RPC", {
  skip: SKIP_NETWORK || !TRACE_TX_HASH
}, async () => {
  const tool = buildRegistry().getTool("trace_tx");
  assert.ok(tool);

  try {
    const result = await tool.execute({
      chainKey: TRACE_CHAIN,
      txHash: TRACE_TX_HASH
    }) as {
      chainKey: string;
      txHash: string;
      callStack: Array<{ depth: number; from: string; input: string; gasUsed?: string }>;
    };

    assert.equal(result.chainKey, TRACE_CHAIN);
    assert.equal(result.txHash.toLowerCase(), TRACE_TX_HASH!.toLowerCase());
    assert.ok(result.callStack.length >= 1);
    assert.equal(result.callStack[0].depth, 0);
    assert.match(result.callStack[0].from, /^0x[0-9a-fA-F]{40}$/);
  } catch (err) {
    if (err instanceof Error && /fetch|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(err.message)) {
      console.log(`[skip] network unreachable: ${err.message}`);
      return;
    }
    throw err;
  }
});

test("trace_tx: rejects missing txHash before RPC", async () => {
  const tool = buildRegistry().getTool("trace_tx");
  assert.ok(tool);

  await assert.rejects(
    () => tool.execute({ chainKey: "sepolia" }),
    /trace_tx requires a txHash arg/
  );
});

test("trace_tx: rejects unknown chain", async () => {
  const tool = buildRegistry().getTool("trace_tx");
  assert.ok(tool);

  await assert.rejects(
    () =>
      tool.execute({
        chainKey: "totally-not-a-chain",
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111"
      }),
    /Unsupported chain/
  );
});
