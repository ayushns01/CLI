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

test("runCli routes deploy --artifact to deploy_contract with artifact bytecode and contract name", async () => {
  const calls: ToolCall[] = [];
  const artifactPath = writeTempArtifact("Token", "0x60006000");
  const result = await runCli(
    [
      "deploy",
      "--chain",
      "sepolia",
      "--artifact",
      artifactPath,
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
  assert.match(result.stdout, /contract: Token/);
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

test("runCli deploy fails when neither --bytecode nor --artifact is provided", async () => {
  const calls: ToolCall[] = [];
  const result = await runCli(
    [
      "deploy",
      "--chain",
      "sepolia",
      "--private-key",
      "0x1111111111111111111111111111111111111111111111111111111111111111",
      "--confirm-broadcast"
    ],
    fakeDeps(calls)
  );

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /Missing deploy input: provide --bytecode or --artifact/);
  assert.deepEqual(calls, []);
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

test("runCli deploys to multiple chains when --chain is comma-separated", async () => {
  const calls: ToolCall[] = [];
  const deployResult = {
    contractAddress: "0x2222222222222222222222222222222222222222",
    transactionHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
    blockNumber: "123"
  };
  const result = await runCli(
    [
      "deploy",
      "--chain", "sepolia,base-sepolia",
      "--bytecode", "0x60006000",
      "--private-key", "0x1111111111111111111111111111111111111111111111111111111111111111",
      "--confirm-broadcast"
    ],
    fakeDeps(calls, { deploy_contract: deployResult })
  );

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Multi-chain deploy/);
  assert.match(result.stdout, /sepolia/);
  assert.match(result.stdout, /base-sepolia/);
  assert.match(result.stdout, /Deployed: 2\/2 chains/);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].name, "deploy_contract");
  assert.equal(calls[0].args.chainKey, "sepolia");
  assert.equal(calls[1].args.chainKey, "base-sepolia");
});

test("runCli multi-chain deploy shows failed chains and still reports partial success", async () => {
  const calls: ToolCall[] = [];
  let callCount = 0;
  const result = await runCli(
    [
      "deploy",
      "--chain", "sepolia,base-sepolia",
      "--bytecode", "0x60006000",
      "--private-key", "0x1111111111111111111111111111111111111111111111111111111111111111",
      "--confirm-broadcast"
    ],
    {
      toolRegistry: {
        executeTool: async (name: string, args: Record<string, unknown>) => {
          calls.push({ name, args });
          callCount++;
          if (callCount === 2) {
            throw new Error("insufficient funds");
          }
          return {
            contractAddress: "0x2222222222222222222222222222222222222222",
            transactionHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
            blockNumber: "123"
          };
        }
      },
      chainRegistry: fakeChainRegistry()
    }
  );

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Deployed: 1\/2 chains/);
  assert.match(result.stdout, /insufficient funds/);
});

test("runCli verify command skips when ETHERSCAN_API_KEY is not set", async () => {
  const savedKey = process.env.ETHERSCAN_API_KEY;
  delete process.env.ETHERSCAN_API_KEY;

  try {
    const result = await runCli(
      ["verify", "--chain", "sepolia", "--address", "0x2222222222222222222222222222222222222222"],
      fakeDeps([])
    );

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /ETHERSCAN_API_KEY not set/);
  } finally {
    if (savedKey !== undefined) {
      process.env.ETHERSCAN_API_KEY = savedKey;
    }
  }
});

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

function fakeChainRegistry() {
  return {
    all: () => [
      { key: "ethereum", environment: "mainnet" },
      { key: "sepolia", environment: "testnet" },
      { key: "base-sepolia", environment: "testnet" }
    ],
    getByName: (name: string) => {
      const chains: Record<string, { key: string; environment: string; explorerUrl: string; verifierApiUrl?: string }> = {
        ethereum: { key: "ethereum", environment: "mainnet", explorerUrl: "https://etherscan.io", verifierApiUrl: "https://api.etherscan.io/api" },
        sepolia: { key: "sepolia", environment: "testnet", explorerUrl: "https://sepolia.etherscan.io", verifierApiUrl: "https://api-sepolia.etherscan.io/api" },
        "base-sepolia": { key: "base-sepolia", environment: "testnet", explorerUrl: "https://sepolia.basescan.org", verifierApiUrl: "https://api-sepolia.basescan.org/api" }
      };
      const chain = chains[name];
      if (!chain) throw new Error(`Unknown chain: ${name}`);
      return chain;
    }
  };
}

function fakeDeps(calls: ToolCall[], responses: Record<string, unknown> = {}) {
  return {
    toolRegistry: {
      executeTool: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return responses[name] ?? {};
      }
    },
    chainRegistry: fakeChainRegistry()
  };
}

function writeTempArtifact(contractName: string, bytecode: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "chainmind-artifact-"));
  const artifactPath = path.join(dir, `${contractName}.json`);
  writeFileSync(
    artifactPath,
    JSON.stringify({
      contractName,
      abi: [],
      bytecode
    })
  );
  return artifactPath;
}
