import test from "node:test";
import assert from "node:assert/strict";

import { getNativeBalance, getNativeBalancesAcrossChains } from "./balance.ts";
import { decodeCalldata, encodeCalldata } from "./calldata.ts";
import { estimateGasCost } from "./gas.ts";
import { signMessageWithSigner } from "./sign-message.ts";
import type { Signer } from "../../wallet/src/signer.ts";

test("getNativeBalance returns formatted native balance for a chain", async () => {
  const result = await getNativeBalance({
    chainKey: "base-sepolia",
    address: "0x1111111111111111111111111111111111111111",
    symbol: "ETH",
    decimals: 18,
    client: {
      getBalance: async () => 1500000000000000000n
    }
  });

  assert.equal(result.chainKey, "base-sepolia");
  assert.equal(result.balanceWei, 1500000000000000000n);
  assert.equal(result.formatted, "1.5 ETH");
});

test("getNativeBalancesAcrossChains aggregates balances in chain order", async () => {
  const balances = await getNativeBalancesAcrossChains({
    address: "0x1111111111111111111111111111111111111111",
    chains: [
      { key: "sepolia", symbol: "ETH", decimals: 18 },
      { key: "base-sepolia", symbol: "ETH", decimals: 18 }
    ],
    createClient: (chainKey) => ({
      getBalance: async () => (chainKey === "sepolia" ? 1n : 2n)
    })
  });

  assert.deepEqual(
    balances.map((balance) => [balance.chainKey, balance.balanceWei]),
    [
      ["sepolia", 1n],
      ["base-sepolia", 2n]
    ]
  );
});

test("encodeCalldata combines a selector and 32-byte words", () => {
  const calldata = encodeCalldata({
    selector: "0xa9059cbb",
    words: [
      "0000000000000000000000001111111111111111111111111111111111111111",
      "00000000000000000000000000000000000000000000000000000000000003e8"
    ]
  });

  assert.equal(
    calldata,
    "0xa9059cbb000000000000000000000000111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000003e8"
  );
});

test("decodeCalldata splits selector and 32-byte words", () => {
  const decoded = decodeCalldata(
    "0xa9059cbb000000000000000000000000111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000003e8"
  );

  assert.equal(decoded.selector, "0xa9059cbb");
  assert.deepEqual(decoded.words, [
    "0000000000000000000000001111111111111111111111111111111111111111",
    "00000000000000000000000000000000000000000000000000000000000003e8"
  ]);
});

test("estimateGasCost calculates total cost", () => {
  const result = estimateGasCost({
    gasLimit: 21000n,
    maxFeePerGasWei: 1000000000n,
    symbol: "ETH",
    decimals: 18
  });

  assert.equal(result.totalWei, 21000000000000n);
  assert.equal(result.formatted, "0.000021 ETH");
});

test("signMessageWithSigner delegates to the signer", async () => {
  const signer: Signer = {
    type: "local-keychain",
    address: "0x2222222222222222222222222222222222222222",
    signMessage: async (message) => `signed:${message}`
  };

  const result = await signMessageWithSigner(signer, "hello");

  assert.deepEqual(result, {
    address: "0x2222222222222222222222222222222222222222",
    signature: "signed:hello"
  });
});
