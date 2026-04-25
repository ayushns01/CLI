import test from "node:test";
import assert from "node:assert/strict";

import { createWalletStore, type WalletRecord } from "./keychain.ts";
import type { Signer } from "./signer.ts";
import { assertSessionAllows, createSessionScope } from "./session-scope.ts";

test("wallet store saves and resolves a wallet label", () => {
  const store = createWalletStore();

  const wallet: WalletRecord = {
    label: "deployer",
    address: "0x1111111111111111111111111111111111111111",
    signerType: "local-keychain"
  };

  store.save(wallet);

  assert.deepEqual(store.getByLabel("deployer"), wallet);
});

test("wallet store throws for unknown labels", () => {
  const store = createWalletStore();

  assert.throws(() => store.getByLabel("missing"), /Unknown wallet label/);
});

test("signer abstraction exposes address and signing capabilities", async () => {
  const signer: Signer = {
    type: "hardware",
    address: "0x2222222222222222222222222222222222222222",
    signMessage: async (message) => `signed:${message}`
  };

  assert.equal(signer.address, "0x2222222222222222222222222222222222222222");
  assert.equal(await signer.signMessage("hello"), "signed:hello");
});

test("read-only session allows reads and rejects signing", () => {
  const scope = createSessionScope({
    walletLabel: "deployer",
    chains: ["base-sepolia"],
    permissions: ["read"]
  });

  assertSessionAllows(scope, { chain: "base-sepolia", permission: "read" });
  assert.throws(
    () => assertSessionAllows(scope, { chain: "base-sepolia", permission: "sign" }),
    /Permission not allowed/
  );
});

test("session scope rejects chains outside the allowed set", () => {
  const scope = createSessionScope({
    walletLabel: "deployer",
    chains: ["base-sepolia"],
    permissions: ["read", "simulate", "sign", "broadcast"]
  });

  assert.throws(
    () => assertSessionAllows(scope, { chain: "ethereum", permission: "read" }),
    /Chain not allowed/
  );
});

test("broadcast permission requires explicit broadcast scope", () => {
  const scope = createSessionScope({
    walletLabel: "deployer",
    chains: ["base-sepolia"],
    permissions: ["read", "simulate", "sign"]
  });

  assert.throws(
    () => assertSessionAllows(scope, { chain: "base-sepolia", permission: "broadcast" }),
    /Permission not allowed/
  );
});
