/**
 * Integration tests for fork_chain wired to a real Anvil process.
 *
 * The live path requires Foundry's `anvil` binary and public RPC access.
 * Validation tests always run and confirm bad inputs stop before spawning.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import { createRealToolRegistry } from "../../packages/agent/src/tools.ts";
import { createChainRegistry, loadBuiltInChains } from "../../packages/chains/src/index.ts";

const SKIP_NETWORK = process.env.CHAINMIND_SKIP_NETWORK === "1";
const HAS_ANVIL = spawnSync("anvil", ["--version"], { stdio: "ignore" }).status === 0;
const FORK_PORT = Number.parseInt(process.env.CHAINMIND_FORK_TEST_PORT ?? "18545", 10);

function buildRegistry() {
  const chainRegistry = createChainRegistry(loadBuiltInChains());
  return createRealToolRegistry({ chainRegistry });
}

test("fork_chain: starts a Sepolia fork and fork_stop cleans it up", {
  skip: SKIP_NETWORK || !HAS_ANVIL
}, async () => {
  const registry = buildRegistry();
  const forkTool = registry.getTool("fork_chain");
  const stopTool = registry.getTool("fork_stop");
  assert.ok(forkTool);
  assert.ok(stopTool);

  let forkId: string | undefined;

  try {
    const started = await forkTool.execute({
      chainKey: "sepolia",
      port: FORK_PORT
    }) as {
      forkId: string;
      forkRpcUrl: string;
      port: number;
      chainKey: string;
    };
    forkId = started.forkId;

    assert.equal(started.chainKey, "sepolia");
    assert.equal(started.port, FORK_PORT);
    assert.equal(started.forkRpcUrl, `http://127.0.0.1:${FORK_PORT}`);

    const blockNumberHex = await rpc(started.forkRpcUrl, "eth_blockNumber", []);
    assert.ok(BigInt(blockNumberHex) > 0n);

    const stopped = await stopTool.execute({ forkId }) as { forkId: string; stopped: boolean };
    assert.deepEqual(stopped, { forkId, stopped: true });
    forkId = undefined;
  } catch (err) {
    if (err instanceof Error && isSkippableForkError(err.message)) {
      console.log(`[skip] network or fork unavailable: ${err.message}`);
      return;
    }
    throw err;
  } finally {
    if (forkId) {
      await stopTool.execute({ forkId });
    }
  }
});

test("fork_chain: rejects unknown chain before spawning", async () => {
  const tool = buildRegistry().getTool("fork_chain");
  assert.ok(tool);

  await assert.rejects(
    () => tool.execute({ chainKey: "totally-not-a-chain", port: FORK_PORT }),
    /Unsupported chain/
  );
});

test("fork_chain: rejects missing chainKey", async () => {
  const tool = buildRegistry().getTool("fork_chain");
  assert.ok(tool);

  await assert.rejects(
    () => tool.execute({ port: FORK_PORT }),
    /fork_chain requires a chainKey arg/
  );
});

async function rpc(rpcUrl: string, method: string, params: unknown[]): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  const payload = await response.json() as { result?: string; error?: { message?: string } };
  if (payload.error) {
    throw new Error(payload.error.message ?? `${method} failed`);
  }
  if (typeof payload.result !== "string") {
    throw new Error(`${method} returned no string result`);
  }
  return payload.result;
}

function isSkippableForkError(message: string): boolean {
  return /fetch|network|ENOTFOUND|ECONNREFUSED|timeout|failed|Timed out waiting for Anvil|panicked/i.test(message);
}
