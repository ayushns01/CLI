import test from "node:test";
import assert from "node:assert/strict";

import { renderForkSession } from "../../apps/cli/src/commands/fork.ts";
import { renderTraceReport } from "../../apps/cli/src/commands/trace.ts";

test("trace renderer shows decoded call stack and failure details", () => {
  const output = renderTraceReport({
    chainKey: "base-sepolia",
    txHash: "0xabc",
    callStack: [
      {
        depth: 0,
        type: "CALL",
        from: "0x1111111111111111111111111111111111111111",
        to: "0x2222222222222222222222222222222222222222",
        input: "0xa9059cbb",
        decodedCall: "transfer(address,uint256)",
        gasUsed: 50000n
      },
      {
        depth: 1,
        type: "STATICCALL",
        from: "0x2222222222222222222222222222222222222222",
        to: "0x3333333333333333333333333333333333333333",
        input: "0x70a08231",
        decodedCall: "balanceOf(address)",
        gasUsed: 12000n,
        error: "Insufficient"
      }
    ]
  });

  assert.match(output, /base-sepolia/);
  assert.match(output, /0xabc/);
  assert.match(output, /0 CALL transfer\(address,uint256\)/);
  assert.match(output, /1 STATICCALL balanceOf\(address\) ERROR: Insufficient/);
});

test("fork renderer shows local fork endpoint and source block", () => {
  const output = renderForkSession({
    id: "base-sepolia:8545",
    chainKey: "base-sepolia",
    sourceRpcUrl: "https://rpc.example",
    rpcUrl: "http://127.0.0.1:8545",
    blockNumber: 123n,
    port: 8545,
    stop: async () => {}
  });

  assert.match(output, /base-sepolia/);
  assert.match(output, /http:\/\/127.0.0.1:8545/);
  assert.match(output, /123/);
});
