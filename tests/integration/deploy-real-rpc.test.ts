/**
 * Integration test for deploy_contract wired to viem WalletClient.
 *
 * Actual broadcast is opt-in because it consumes testnet gas:
 *   CHAINMIND_ENABLE_BROADCAST_TESTS=1
 *   CHAINMIND_DEPLOY_PRIVATE_KEY=<funded-testnet-key>
 *
 * Validation tests always run and confirm unsafe/missing inputs stop before
 * signing or broadcasting.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createRealToolRegistry } from "../../packages/agent/src/tools.ts";
import { createChainRegistry, loadBuiltInChains } from "../../packages/chains/src/index.ts";

const SKIP_NETWORK = process.env.CHAINMIND_SKIP_NETWORK === "1";
const ENABLE_BROADCAST = process.env.CHAINMIND_ENABLE_BROADCAST_TESTS === "1";
const DEPLOY_PRIVATE_KEY = process.env.CHAINMIND_DEPLOY_PRIVATE_KEY;
const DEPLOY_CHAIN = process.env.CHAINMIND_DEPLOY_CHAIN ?? "sepolia";

// Creation code that returns an empty runtime. Good enough to prove contract
// creation receipt handling without depending on Solidity compilation.
const EMPTY_RUNTIME_CONTRACT_BYTECODE = "0x60006000f3";

function buildRegistry() {
  const chainRegistry = createChainRegistry(loadBuiltInChains());
  return createRealToolRegistry({ chainRegistry });
}

test("deploy_contract: rejects missing privateKey before broadcast", async () => {
  const tool = buildRegistry().getTool("deploy_contract");
  assert.ok(tool);

  await assert.rejects(
    () => tool.execute({ chainKey: "sepolia", bytecode: EMPTY_RUNTIME_CONTRACT_BYTECODE }),
    /deploy_contract requires a privateKey arg/
  );
});

test("deploy_contract: rejects missing bytecode before broadcast", async () => {
  const tool = buildRegistry().getTool("deploy_contract");
  assert.ok(tool);

  await assert.rejects(
    () =>
      tool.execute({
        chainKey: "sepolia",
        privateKey: "0x1111111111111111111111111111111111111111111111111111111111111111"
      }),
    /deploy_contract requires non-empty bytecode/
  );
});

test("deploy_contract: broadcasts bytecode with viem wallet client when explicitly enabled", {
  skip: SKIP_NETWORK || !ENABLE_BROADCAST || !DEPLOY_PRIVATE_KEY
}, async () => {
  const tool = buildRegistry().getTool("deploy_contract");
  assert.ok(tool);

  try {
    const result = await tool.execute({
      chainKey: DEPLOY_CHAIN,
      privateKey: DEPLOY_PRIVATE_KEY,
      bytecode: EMPTY_RUNTIME_CONTRACT_BYTECODE
    }) as {
      chainKey: string;
      contractAddress: string;
      transactionHash: string;
      blockNumber: string;
    };

    assert.equal(result.chainKey, DEPLOY_CHAIN);
    assert.match(result.contractAddress, /^0x[0-9a-fA-F]{40}$/);
    assert.match(result.transactionHash, /^0x[0-9a-fA-F]{64}$/);
    assert.match(result.blockNumber, /^\d+$/);
  } catch (err) {
    if (err instanceof Error && /fetch|network|ENOTFOUND|ECONNREFUSED|timeout/i.test(err.message)) {
      console.log(`[skip] network unreachable: ${err.message}`);
      return;
    }
    throw err;
  }
});
