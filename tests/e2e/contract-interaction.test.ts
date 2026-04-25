import test from "node:test";
import assert from "node:assert/strict";

import { renderContractStudio, renderWritePreview } from "../../apps/cli/src/commands/contract/studio.ts";

test("contract studio renderer lists read and write functions", () => {
  const output = renderContractStudio({
    contractName: "Token",
    address: "0x3333333333333333333333333333333333333333",
    functions: [
      { name: "balanceOf", kind: "read", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "balance", type: "uint256" }] },
      { name: "transfer", kind: "write", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] }
    ]
  });

  assert.match(output, /Token/);
  assert.match(output, /balanceOf\(address owner\) -> uint256 balance \[read\]/);
  assert.match(output, /transfer\(address to, uint256 amount\) \[write\]/);
});

test("write preview renderer shows transaction and simulation result", () => {
  const output = renderWritePreview({
    preview: {
      chainKey: "base-sepolia",
      from: "0x2222222222222222222222222222222222222222",
      to: "0x3333333333333333333333333333333333333333",
      data: "0xa9059cbb",
      valueWei: 0n,
      gasLimit: 50000n,
      riskLevel: "medium",
      requiresApproval: true,
      description: "Token.transfer"
    },
    simulation: {
      success: true,
      gasUsed: 42100n,
      stateChanges: ["Token.balance:-1000"]
    }
  });

  assert.match(output, /base-sepolia/);
  assert.match(output, /Token.transfer/);
  assert.match(output, /simulation: success/);
  assert.match(output, /gasUsed: 42100/);
});
