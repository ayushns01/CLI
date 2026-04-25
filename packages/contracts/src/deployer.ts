import type { ContractArtifact } from "./artifact-loader.ts";

export interface DeployDataInput {
  bytecode: string;
  constructorWords: string[];
}

export interface ContractDeploymentPlan {
  contractName: string;
  chainKey: string;
  from: string;
  deployData: string;
  constructorWords: string[];
}

export interface ContractDeploymentPlanInput {
  artifact: ContractArtifact;
  chainKey: string;
  from: string;
  constructorWords?: string[];
}

export interface DeploymentReceipt {
  contractAddress: string;
  transactionHash: string;
  blockNumber: bigint;
}

export interface DeploymentRecord {
  contractName: string;
  chainKey: string;
  address: string;
  transactionHash: string;
  blockNumber: bigint;
}

export interface Erc20DeployIntentInput {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  chainKey: string;
}

export interface Erc20DeployIntent extends Erc20DeployIntentInput {
  contractName: "ERC20";
  constructorArgs: [string, string, number, string];
}

export function buildDeployData(input: DeployDataInput): string {
  const bytecode = normalizeBytecode(input.bytecode);
  return `0x${bytecode.slice(2)}${input.constructorWords.map(normalizeWord).join("")}`;
}

export function buildContractDeploymentPlan(input: ContractDeploymentPlanInput): ContractDeploymentPlan {
  const constructorWords = input.constructorWords ?? [];

  return {
    contractName: input.artifact.contractName,
    chainKey: input.chainKey,
    from: input.from,
    deployData: buildDeployData({
      bytecode: input.artifact.bytecode,
      constructorWords
    }),
    constructorWords
  };
}

export function createDeploymentRecord(plan: ContractDeploymentPlan, receipt: DeploymentReceipt): DeploymentRecord {
  return {
    contractName: plan.contractName,
    chainKey: plan.chainKey,
    address: receipt.contractAddress,
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber
  };
}

export function buildErc20DeployIntent(input: Erc20DeployIntentInput): Erc20DeployIntent {
  return {
    ...input,
    contractName: "ERC20",
    constructorArgs: [input.name, input.symbol, input.decimals, input.initialSupply]
  };
}

function normalizeBytecode(value: string): string {
  const normalized = value.startsWith("0x") ? value.toLowerCase() : `0x${value.toLowerCase()}`;
  if (!/^0x[0-9a-f]+$/.test(normalized)) {
    throw new Error(`Invalid bytecode: ${value}`);
  }
  return normalized;
}

function normalizeWord(value: string): string {
  const word = value.startsWith("0x") ? value.slice(2).toLowerCase() : value.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(word)) {
    throw new Error("Constructor words must be exactly 32 bytes");
  }
  return word;
}
