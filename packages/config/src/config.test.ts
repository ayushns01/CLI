import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";

import { getDefaultConfigSearchPaths, loadLocalConfig, resolveDefaultChain } from "./index.ts";
import { createChainRegistry, loadBuiltInChains } from "../../chains/src/index.ts";

test("loadLocalConfig reads a local config file", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "chainmind-config-"));
  const configPath = path.join(tempDir, "chainmind.config.json");

  writeFileSync(
    configPath,
    JSON.stringify({
      defaultChain: "base-sepolia",
      rpcOverrides: {
        "base-sepolia": ["https://rpc.example"]
      }
    })
  );

  const config = loadLocalConfig(configPath);

  assert.equal(config.defaultChain, "base-sepolia");
  assert.deepEqual(config.rpcOverrides?.["base-sepolia"], ["https://rpc.example"]);
});

test("resolveDefaultChain resolves a configured chain alias", () => {
  const registry = createChainRegistry(loadBuiltInChains());
  const chain = resolveDefaultChain({ defaultChain: "base" }, registry);

  assert.equal(chain.id, 8453);
  assert.equal(chain.key, "base");
});

test("getDefaultConfigSearchPaths includes future workspace yaml support", () => {
  const searchPaths = getDefaultConfigSearchPaths("/tmp/chainmind-project");

  assert.deepEqual(searchPaths, [
    "/tmp/chainmind-project/chainmind.config.json",
    "/tmp/chainmind-project/.chainmind.yaml"
  ]);
});
