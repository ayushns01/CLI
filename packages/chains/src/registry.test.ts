import test from "node:test";
import assert from "node:assert/strict";

import { createChainRegistry, loadBuiltInChains } from "./index.ts";

test("registry lookup by chain name resolves aliases", () => {
  const registry = createChainRegistry(loadBuiltInChains());
  const chain = registry.getByName("base sepolia");

  assert.equal(chain.id, 84532);
  assert.equal(chain.key, "base-sepolia");
});

test("registry lookup by chain ID resolves the matching chain", () => {
  const registry = createChainRegistry(loadBuiltInChains());
  const chain = registry.getById(1);

  assert.equal(chain.name, "Ethereum");
  assert.equal(chain.key, "ethereum");
});

test("registry throws for unsupported chains", () => {
  const registry = createChainRegistry(loadBuiltInChains());

  assert.throws(() => registry.getByName("unknown-chain"), /Unsupported chain/);
});
