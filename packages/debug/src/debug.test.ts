import test from "node:test";
import assert from "node:assert/strict";

import { startFork } from "./fork.ts";
import { buildRevertExplainerInput } from "./revert-explainer-input.ts";
import { buildTraceReport, fetchTransactionTrace } from "./trace.ts";

const revertedErrorData =
  "0x08c379a0" +
  "0000000000000000000000000000000000000000000000000000000000000020" +
  "000000000000000000000000000000000000000000000000000000000000000c" +
  "496e73756666696369656e740000000000000000000000000000000000000000";

test("fetchTransactionTrace retrieves a trace by transaction hash", async () => {
  const trace = await fetchTransactionTrace({
    chainKey: "base-sepolia",
    txHash: "0xabc",
    client: {
      getTrace: async (txHash) => ({
        txHash,
        root: {
          type: "CALL",
          from: "0x1111111111111111111111111111111111111111",
          to: "0x2222222222222222222222222222222222222222",
          input: "0xa9059cbb",
          valueWei: 0n,
          gasUsed: 50000n,
          calls: []
        }
      })
    }
  });

  assert.equal(trace.chainKey, "base-sepolia");
  assert.equal(trace.txHash, "0xabc");
  assert.equal(trace.root.to, "0x2222222222222222222222222222222222222222");
});

test("buildTraceReport creates decoded call stack output", () => {
  const report = buildTraceReport({
    chainKey: "base-sepolia",
    txHash: "0xabc",
    root: {
      type: "CALL",
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      input: "0xa9059cbb",
      selector: "transfer(address,uint256)",
      valueWei: 0n,
      gasUsed: 50000n,
      calls: [
        {
          type: "STATICCALL",
          from: "0x2222222222222222222222222222222222222222",
          to: "0x3333333333333333333333333333333333333333",
          input: "0x70a08231",
          selector: "balanceOf(address)",
          valueWei: 0n,
          gasUsed: 12000n,
          error: "Insufficient"
        }
      ]
    }
  });

  assert.deepEqual(report.callStack.map((entry) => entry.depth), [0, 1]);
  assert.equal(report.callStack[0].decodedCall, "transfer(address,uint256)");
  assert.equal(report.callStack[1].error, "Insufficient");
});

test("buildRevertExplainerInput creates structured AI explanation context", () => {
  const input = buildRevertExplainerInput({
    chainKey: "base-sepolia",
    txHash: "0xabc",
    root: {
      type: "CALL",
      from: "0x1111111111111111111111111111111111111111",
      to: "0x2222222222222222222222222222222222222222",
      input: "0xa9059cbb",
      valueWei: 0n,
      gasUsed: 50000n,
      revertData: revertedErrorData,
      calls: []
    }
  });

  assert.equal(input.revertReason, "Insufficient");
  assert.equal(input.failedCall?.to, "0x2222222222222222222222222222222222222222");
  assert.equal(input.promptFacts[0], "Chain: base-sepolia");
});

test("startFork starts and tears down a local fork through an adapter", async () => {
  const stopped: string[] = [];
  const session = await startFork({
    chainKey: "base-sepolia",
    rpcUrl: "https://rpc.example",
    blockNumber: 123n,
    port: 8545,
    runner: {
      start: async (request) => ({
        id: `${request.chainKey}:${request.port}`,
        rpcUrl: `http://127.0.0.1:${request.port}`,
        blockNumber: request.blockNumber
      }),
      stop: async (id) => {
        stopped.push(id);
      }
    }
  });

  assert.equal(session.id, "base-sepolia:8545");
  assert.equal(session.rpcUrl, "http://127.0.0.1:8545");

  await session.stop();
  assert.deepEqual(stopped, ["base-sepolia:8545"]);
});
