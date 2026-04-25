import test from "node:test";
import assert from "node:assert/strict";

import { buildTransactionPreview } from "./preview.ts";
import { assertSimulationMatchesPreview, decodeRevertReason, simulateTransaction } from "./simulate.ts";

const writeRequest = {
  chainKey: "base-sepolia",
  from: "0x2222222222222222222222222222222222222222",
  to: "0x3333333333333333333333333333333333333333",
  data: "0xa9059cbb",
  valueWei: 0n
};

test("buildTransactionPreview renders the exact write before signing", () => {
  const preview = buildTransactionPreview({
    ...writeRequest,
    gasLimit: 50000n,
    riskLevel: "medium",
    description: "Token.transfer"
  });

  assert.equal(preview.chainKey, "base-sepolia");
  assert.equal(preview.to, "0x3333333333333333333333333333333333333333");
  assert.equal(preview.data, "0xa9059cbb");
  assert.equal(preview.requiresApproval, true);
});

test("simulateTransaction dry-runs calldata before broadcast", async () => {
  const result = await simulateTransaction({
    request: writeRequest,
    client: {
      simulate: async (request) => ({
        success: true,
        gasUsed: 42100n,
        stateChanges: [`${request.to}:balance:-1000`]
      })
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.gasUsed, 42100n);
  assert.deepEqual(result.stateChanges, ["0x3333333333333333333333333333333333333333:balance:-1000"]);
});

test("decodeRevertReason explains standard Error(string) revert data", () => {
  const reason = decodeRevertReason(
    "0x08c379a0" +
      "0000000000000000000000000000000000000000000000000000000000000020" +
      "000000000000000000000000000000000000000000000000000000000000000c" +
      "496e73756666696369656e740000000000000000000000000000000000000000"
  );

  assert.equal(reason, "Insufficient");
});

test("simulateTransaction returns decoded revert reason output", async () => {
  const result = await simulateTransaction({
    request: writeRequest,
    client: {
      simulate: async () => ({
        success: false,
        revertData:
          "0x08c379a0" +
          "0000000000000000000000000000000000000000000000000000000000000020" +
          "000000000000000000000000000000000000000000000000000000000000000c" +
          "496e73756666696369656e740000000000000000000000000000000000000000"
      })
    }
  });

  assert.equal(result.success, false);
  assert.equal(result.revertReason, "Insufficient");
});

test("assertSimulationMatchesPreview blocks simulation mismatch before broadcast", () => {
  const preview = buildTransactionPreview({
    ...writeRequest,
    gasLimit: 50000n,
    riskLevel: "medium"
  });

  assert.throws(
    () =>
      assertSimulationMatchesPreview(preview, {
        ...writeRequest,
        data: "0xdeadbeef"
      }),
    /Simulation request does not match preview/
  );
});
