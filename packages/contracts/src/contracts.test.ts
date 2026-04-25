import test from "node:test";
import assert from "node:assert/strict";

import { parseContractArtifact } from "./artifact-loader.ts";
import {
  buildContractDeploymentPlan,
  buildDeployData,
  buildErc20DeployIntent,
  createDeploymentRecord
} from "./deployer.ts";
import { buildVerificationRequest } from "./verify.ts";

const transferAbi = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "success", type: "bool" }]
  }
];

test("parseContractArtifact reads Hardhat-style artifacts", () => {
  const artifact = parseContractArtifact({
    contractName: "Token",
    abi: transferAbi,
    bytecode: "0x60006000"
  });

  assert.equal(artifact.contractName, "Token");
  assert.equal(artifact.bytecode, "0x60006000");
  assert.deepEqual(artifact.abi, transferAbi);
});

test("parseContractArtifact reads Foundry-style artifacts", () => {
  const artifact = parseContractArtifact({
    abi: transferAbi,
    bytecode: {
      object: "0x60016001"
    }
  }, { contractName: "FoundryToken" });

  assert.equal(artifact.contractName, "FoundryToken");
  assert.equal(artifact.bytecode, "0x60016001");
});

test("parseContractArtifact rejects artifacts missing ABI or bytecode", () => {
  assert.throws(() => parseContractArtifact({ contractName: "Broken", bytecode: "0x00" }), /Artifact ABI is required/);
  assert.throws(() => parseContractArtifact({ contractName: "Broken", abi: [] }), /Artifact bytecode is required/);
});

test("buildDeployData appends constructor words to bytecode", () => {
  const deployData = buildDeployData({
    bytecode: "0x6000",
    constructorWords: [
      "0000000000000000000000001111111111111111111111111111111111111111",
      "00000000000000000000000000000000000000000000000000000000000003e8"
    ]
  });

  assert.equal(
    deployData,
    "0x6000000000000000000000000000111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000003e8"
  );
});

test("buildContractDeploymentPlan captures chain and constructor data", () => {
  const artifact = parseContractArtifact({
    contractName: "Token",
    abi: transferAbi,
    bytecode: "0x6000"
  });

  const plan = buildContractDeploymentPlan({
    artifact,
    chainKey: "base-sepolia",
    from: "0x2222222222222222222222222222222222222222",
    constructorWords: ["00".repeat(32)]
  });

  assert.equal(plan.contractName, "Token");
  assert.equal(plan.chainKey, "base-sepolia");
  assert.equal(plan.from, "0x2222222222222222222222222222222222222222");
  assert.equal(plan.deployData, `0x6000${"00".repeat(32)}`);
});

test("createDeploymentRecord parses receipt output into saved metadata", () => {
  const record = createDeploymentRecord({
    contractName: "Token",
    chainKey: "base-sepolia",
    from: "0x2222222222222222222222222222222222222222",
    deployData: "0x6000",
    constructorWords: []
  }, {
    contractAddress: "0x3333333333333333333333333333333333333333",
    transactionHash: "0xabc",
    blockNumber: 123n
  });

  assert.equal(record.address, "0x3333333333333333333333333333333333333333");
  assert.equal(record.transactionHash, "0xabc");
  assert.equal(record.blockNumber, 123n);
});

test("buildErc20DeployIntent creates a typed ERC-20 shortcut intent", () => {
  const intent = buildErc20DeployIntent({
    name: "MyToken",
    symbol: "MTK",
    decimals: 18,
    initialSupply: "1000000",
    chainKey: "base-sepolia"
  });

  assert.deepEqual(intent.constructorArgs, ["MyToken", "MTK", 18, "1000000"]);
  assert.equal(intent.contractName, "ERC20");
});

test("buildVerificationRequest hides explorer-specific details behind one request shape", () => {
  const request = buildVerificationRequest({
    chainKey: "base-sepolia",
    contractName: "Token",
    contractAddress: "0x3333333333333333333333333333333333333333",
    constructorArgs: ["00".repeat(32)],
    artifactPath: "./artifacts/Token.json"
  });

  assert.equal(request.provider, "explorer");
  assert.equal(request.chainKey, "base-sepolia");
  assert.equal(request.contractAddress, "0x3333333333333333333333333333333333333333");
});
