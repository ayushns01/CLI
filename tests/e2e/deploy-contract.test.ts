import test from "node:test";
import assert from "node:assert/strict";

import { renderContractDeployPlan, renderDeploymentRecord } from "../../apps/cli/src/commands/contract/deploy.ts";
import { renderTokenDeployIntent } from "../../apps/cli/src/commands/token/deploy.ts";

test("contract deploy renderer shows deploy plan details", () => {
  const output = renderContractDeployPlan({
    contractName: "Token",
    chainKey: "base-sepolia",
    from: "0x2222222222222222222222222222222222222222",
    deployData: "0x6000",
    constructorWords: []
  });

  assert.match(output, /Token/);
  assert.match(output, /base-sepolia/);
  assert.match(output, /0x6000/);
});

test("deployment record renderer shows address and tx hash", () => {
  const output = renderDeploymentRecord({
    contractName: "Token",
    chainKey: "base-sepolia",
    address: "0x3333333333333333333333333333333333333333",
    transactionHash: "0xabc",
    blockNumber: 123n
  });

  assert.match(output, /0x3333333333333333333333333333333333333333/);
  assert.match(output, /0xabc/);
});

test("token deploy renderer shows ERC-20 shortcut details", () => {
  const output = renderTokenDeployIntent({
    contractName: "ERC20",
    name: "MyToken",
    symbol: "MTK",
    decimals: 18,
    initialSupply: "1000000",
    chainKey: "base-sepolia",
    constructorArgs: ["MyToken", "MTK", 18, "1000000"]
  });

  assert.match(output, /MyToken/);
  assert.match(output, /MTK/);
  assert.match(output, /base-sepolia/);
});
