import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";

import { createDefaultCliDependencies, runCli } from "./router.ts";

test("runCli routes balance to the real-tool registry", async () => {
  const calls: ToolCall[] = [];
  const result = await runCli(
    ["balance", "--chain", "sepolia", "--address", "0xabc"],
    fakeDeps(calls, {
      balance: {
        chainKey: "sepolia",
        address: "0xabc",
        balance: "1000000000000000000",
        formatted: "1 ETH"
      }
    })
  );

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /chain: sepolia/);
  assert.match(result.stdout, /balance: 1 ETH/);
  assert.deepEqual(calls, [
    { name: "balance", args: { chainKey: "sepolia", address: "0xabc" } }
  ]);
});

test("runCli routes gas estimate to estimate_gas", async () => {
  const calls: ToolCall[] = [];
  const result = await runCli(
    [
      "gas",
      "estimate",
      "--chain",
      "sepolia",
      "--from",
      "0xfrom",
      "--to",
      "0xto",
      "--data",
      "0x",
      "--value-wei",
      "0"
    ],
    fakeDeps(calls, {
      estimate_gas: {
        chainKey: "sepolia",
        gasLimit: "21000",
        maxFeePerGasWei: "1000000000",
        estimatedCostWei: "21000000000000",
        formatted: "0.000021 ETH"
      }
    })
  );

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /gasLimit: 21000/);
  assert.match(result.stdout, /estimated cost: 0.000021 ETH/);
  assert.deepEqual(calls, [
    {
      name: "estimate_gas",
      args: {
        chainKey: "sepolia",
        from: "0xfrom",
        to: "0xto",
        data: "0x",
        valueWei: "0"
      }
    }
  ]);
});

test("runCli routes trace to trace_tx", async () => {
  const calls: ToolCall[] = [];
  const result = await runCli(
    ["trace", "--chain", "sepolia", "--tx", "0xhash"],
    fakeDeps(calls, {
      trace_tx: {
        chainKey: "sepolia",
        txHash: "0xhash",
        callStack: [
          {
            depth: 0,
            type: "CALL",
            from: "0xfrom",
            to: "0xto",
            input: "0xa9059cbb",
            decodedCall: "0xa9059cbb",
            gasUsed: "21000"
          }
        ]
      }
    })
  );

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /transaction: 0xhash/);
  assert.match(result.stdout, /0 CALL 0xa9059cbb/);
  assert.deepEqual(calls, [
    { name: "trace_tx", args: { chainKey: "sepolia", txHash: "0xhash" } }
  ]);
});

test("runCli requires explicit broadcast confirmation for deploy", async () => {
  const calls: ToolCall[] = [];
  const result = await runCli(
    [
      "deploy",
      "--chain",
      "sepolia",
      "--bytecode",
      "0x60006000",
      "--private-key",
      "0x1111111111111111111111111111111111111111111111111111111111111111"
    ],
    fakeDeps(calls)
  );

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /requires --confirm-broadcast/);
  assert.deepEqual(calls, []);
});

test("runCli routes confirmed deploy to deploy_contract", async () => {
  const calls: ToolCall[] = [];
  const result = await runCli(
    [
      "deploy",
      "--chain",
      "sepolia",
      "--bytecode",
      "0x60006000",
      "--private-key",
      "0x1111111111111111111111111111111111111111111111111111111111111111",
      "--confirm-broadcast"
    ],
    fakeDeps(calls, {
      deploy_contract: {
        chainKey: "sepolia",
        contractAddress: "0x2222222222222222222222222222222222222222",
        transactionHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
        blockNumber: "123"
      }
    })
  );

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /address: 0x2222222222222222222222222222222222222222/);
  assert.deepEqual(calls, [
    {
      name: "deploy_contract",
      args: {
        chainKey: "sepolia",
        bytecode: "0x60006000",
        privateKey: "0x1111111111111111111111111111111111111111111111111111111111111111"
      }
    }
  ]);
});

test("runCli allbal --testnet selects only testnet chains", async () => {
  const calls: ToolCall[] = [];
  const result = await runCli(
    ["allbal", "--testnet", "--address", "0xabc"],
    fakeDeps(calls, {
      balances_multi: {
        address: "0xabc",
        balances: [
          { chainKey: "sepolia", balance: "1", formatted: "1 wei ETH" },
          { chainKey: "base-sepolia", balance: "2", formatted: "2 wei ETH" }
        ]
      }
    })
  );

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /sepolia/);
  assert.match(result.stdout, /base-sepolia/);
  assert.deepEqual(calls, [
    {
      name: "balances_multi",
      args: { address: "0xabc", chainKeys: ["sepolia", "base-sepolia"] }
    }
  ]);
});

test("createDefaultCliDependencies applies .chainmind.yaml rpcOverrides", () => {
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), "chainmind-cli-config-"));
  writeFileSync(
    path.join(projectRoot, ".chainmind.yaml"),
    [
      "rpcOverrides:",
      "  sepolia:",
      "    - https://alchemy.example/sepolia",
      "  base-sepolia:",
      "    - https://alchemy.example/base-sepolia"
    ].join("\n")
  );

  const deps = createDefaultCliDependencies({ projectRoot });
  const sepolia = deps.chainRegistry.getByName("sepolia");
  const baseSepolia = deps.chainRegistry.getByName("base-sepolia");

  assert.deepEqual(sepolia.rpcUrls, ["https://alchemy.example/sepolia"]);
  assert.deepEqual(baseSepolia.rpcUrls, ["https://alchemy.example/base-sepolia"]);
});

test("createDefaultCliDependencies applies .chainmind.yaml chainAliases", () => {
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), "chainmind-cli-config-"));
  writeFileSync(
    path.join(projectRoot, ".chainmind.yaml"),
    [
      "chainAliases:",
      "  localSepolia: sepolia"
    ].join("\n")
  );

  const deps = createDefaultCliDependencies({ projectRoot });
  const chain = deps.chainRegistry.getByName("localSepolia");

  assert.equal(chain.key, "sepolia");
});

test("createDefaultCliDependencies applies CHAINMIND_ENV environment rpcOverrides", () => {
  const originalEnv = process.env.CHAINMIND_ENV;
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), "chainmind-cli-config-"));
  writeFileSync(
    path.join(projectRoot, ".chainmind.yaml"),
    [
      "rpcOverrides:",
      "  sepolia:",
      "    - https://public.example/sepolia",
      "environments:",
      "  prod:",
      "    rpcOverrides:",
      "      sepolia:",
      "        - https://alchemy.example/prod-sepolia"
    ].join("\n")
  );

  try {
    process.env.CHAINMIND_ENV = "prod";
    const deps = createDefaultCliDependencies({ projectRoot });
    const chain = deps.chainRegistry.getByName("sepolia");

    assert.deepEqual(chain.rpcUrls, ["https://alchemy.example/prod-sepolia"]);
  } finally {
    if (originalEnv === undefined) {
      delete process.env.CHAINMIND_ENV;
    } else {
      process.env.CHAINMIND_ENV = originalEnv;
    }
  }
});

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

function fakeDeps(calls: ToolCall[], responses: Record<string, unknown> = {}) {
  return {
    toolRegistry: {
      executeTool: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return responses[name] ?? {};
      }
    },
    chainRegistry: {
      all: () => [
        { key: "ethereum", environment: "mainnet" },
        { key: "sepolia", environment: "testnet" },
        { key: "base-sepolia", environment: "testnet" }
      ]
    }
  };
}
