import test from "node:test";
import assert from "node:assert/strict";

import { renderBalanceResult } from "../../apps/cli/src/commands/balance.ts";
import { renderAllBalancesResult } from "../../apps/cli/src/commands/allbal.ts";
import { renderCalldataDecodeResult } from "../../apps/cli/src/commands/calldata/decode.ts";
import { renderCalldataEncodeResult } from "../../apps/cli/src/commands/calldata/encode.ts";
import { renderGasEstimateResult } from "../../apps/cli/src/commands/gas/estimate.ts";
import { renderSignMessageResult } from "../../apps/cli/src/commands/sign-message.ts";

test("balance command renderer shows chain, address, and formatted balance", () => {
  const output = renderBalanceResult({
    chainKey: "base-sepolia",
    address: "0x1111111111111111111111111111111111111111",
    balanceWei: 1n,
    formatted: "0.000000000000000001 ETH"
  });

  assert.match(output, /base-sepolia/);
  assert.match(output, /0x1111111111111111111111111111111111111111/);
  assert.match(output, /0.000000000000000001 ETH/);
});

test("allbal command renderer lists multiple chains", () => {
  const output = renderAllBalancesResult([
    { chainKey: "sepolia", address: "0xabc", balanceWei: 1n, formatted: "1 ETH" },
    { chainKey: "base-sepolia", address: "0xabc", balanceWei: 2n, formatted: "2 ETH" }
  ]);

  assert.match(output, /sepolia/);
  assert.match(output, /base-sepolia/);
});

test("calldata command renderers show encoded and decoded values", () => {
  const encoded = renderCalldataEncodeResult("0xa9059cbb");
  const decoded = renderCalldataDecodeResult({
    selector: "0xa9059cbb",
    words: ["00".repeat(32)]
  });

  assert.match(encoded, /0xa9059cbb/);
  assert.match(decoded, /selector: 0xa9059cbb/);
});

test("gas estimate and sign message renderers return concise command output", () => {
  assert.match(renderGasEstimateResult({ totalWei: 1n, formatted: "0.000000000000000001 ETH" }), /0.000000000000000001 ETH/);
  assert.match(renderSignMessageResult({ address: "0xabc", signature: "0xsig" }), /0xsig/);
});
