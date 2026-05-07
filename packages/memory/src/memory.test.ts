import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";

import { SqliteWorkspaceStore } from "./sqlite-store.ts";

function createStore(): SqliteWorkspaceStore {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "chainmind-memory-"));
  return new SqliteWorkspaceStore(path.join(tempDir, "memory.sqlite"));
}

test("workspace memory saves and resolves wallet labels", () => {
  const store = createStore();

  store.saveWallet({
    label: "dev",
    address: "0x1111111111111111111111111111111111111111",
    signerType: "local-keychain"
  });

  assert.deepEqual(store.getWallet("dev"), {
    label: "dev",
    address: "0x1111111111111111111111111111111111111111",
    signerType: "local-keychain"
  });
  assert.equal(store.listWallets().length, 1);

  store.close();
});

test("workspace memory saves contract deployment metadata", () => {
  const store = createStore();

  store.saveContract({
    name: "Token",
    chainKey: "base-sepolia",
    address: "0x2222222222222222222222222222222222222222",
    transactionHash: "0xabc",
    blockNumber: 123n,
    artifactPath: "./artifacts/Token.json"
  });

  const contracts = store.listContracts("base-sepolia");
  assert.equal(contracts.length, 1);
  assert.equal(contracts[0].name, "Token");
  assert.equal(contracts[0].blockNumber, 123n);
  assert.equal(store.getContract("Token", "base-sepolia")?.address, "0x2222222222222222222222222222222222222222");

  store.close();
});

test("workspace memory records execution history in newest-first order", () => {
  const store = createStore();

  store.recordRun({
    id: "run-1",
    command: "chainmind balance",
    status: "success",
    chainKey: "sepolia",
    summary: "balance checked",
    startedAt: "2026-04-26T10:00:00.000Z",
    finishedAt: "2026-04-26T10:00:01.000Z"
  });
  store.recordRun({
    id: "run-2",
    command: "chainmind trace 0xabc",
    status: "failed",
    chainKey: "base-sepolia",
    summary: "trace failed",
    startedAt: "2026-04-26T10:01:00.000Z"
  });

  assert.deepEqual(
    store.listRuns().map((run) => [run.id, run.status]),
    [
      ["run-2", "failed"],
      ["run-1", "success"]
    ]
  );

  store.close();
});

test("workspace memory persists preferences and environment profiles", () => {
  const store = createStore();

  store.savePreferences({
    defaultWallet: "dev",
    defaultChain: "base-sepolia",
    preferredChains: ["sepolia", "base-sepolia"]
  });
  store.saveEnvironment({
    name: "devnet",
    defaultChain: "base-sepolia",
    rpcOverrides: {
      "base-sepolia": ["https://rpc.example"]
    }
  });

  assert.deepEqual(store.getPreferences(), {
    defaultWallet: "dev",
    defaultChain: "base-sepolia",
    preferredChains: ["sepolia", "base-sepolia"]
  });
  assert.deepEqual(store.getEnvironment("devnet")?.rpcOverrides["base-sepolia"], ["https://rpc.example"]);

  store.close();
});


test('address book saves, lists, removes, and resolves addresses', () => {
  const store = createStore();
  const now = new Date().toISOString();
  store.saveAddress({ name: 'treasury', address: '0x123', chainKey: 'sepolia', createdAt: now });
  store.saveAddress({ name: 'vitalik', address: '0xabc', createdAt: now });
  assert.equal(store.listAddresses().length, 2);
  const treasury = store.getAddress('treasury');
  assert.equal(treasury?.address, '0x123');
  assert.equal(treasury?.chainKey, 'sepolia');
  assert.equal(store.resolveAddress('treasury'), '0x123');
  assert.equal(store.resolveAddress('0x456'), '0x456');
  assert.equal(store.resolveAddress('name.eth'), 'name.eth');
  assert.throws(() => store.resolveAddress('unknown'), /not found/);
  store.removeAddress('treasury');
  assert.equal(store.listAddresses().length, 1);
  assert.equal(store.getAddress('treasury'), undefined);
  store.close();
});
