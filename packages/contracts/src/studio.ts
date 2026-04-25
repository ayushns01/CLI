import type { ContractArtifact } from "./artifact-loader.ts";

export interface AbiParameter {
  name?: string;
  type: string;
}

export interface AbiFunction {
  type: "function";
  name: string;
  stateMutability?: "pure" | "view" | "nonpayable" | "payable";
  inputs?: AbiParameter[];
  outputs?: AbiParameter[];
}

export type ContractFunctionKind = "read" | "write";

export interface ContractFunctionSummary {
  name: string;
  kind: ContractFunctionKind;
  inputs: AbiParameter[];
  outputs: AbiParameter[];
}

export interface ContractReadCall {
  kind: "read";
  contractName: string;
  address: string;
  functionName: string;
  args: string[];
  inputs: AbiParameter[];
  outputs: AbiParameter[];
}

export interface ContractWriteCall extends Omit<ContractReadCall, "kind"> {
  kind: "write";
  chainKey: string;
  from: string;
  calldata: string;
  valueWei: bigint;
}

export interface BuildContractReadCallInput {
  artifact: ContractArtifact;
  address: string;
  functionName: string;
  args: string[];
}

export interface BuildContractWriteCallInput extends BuildContractReadCallInput {
  chainKey: string;
  from: string;
  calldata: string;
  valueWei?: bigint;
}

export function listContractFunctions(abi: unknown[]): ContractFunctionSummary[] {
  return abi
    .filter(isAbiFunction)
    .map((entry) => ({
      name: entry.name,
      kind: isReadFunction(entry) ? "read" : "write",
      inputs: entry.inputs ?? [],
      outputs: entry.outputs ?? []
    }));
}

export function buildContractReadCall(input: BuildContractReadCallInput): ContractReadCall {
  const fragment = findFunction(input.artifact.abi, input.functionName);
  if (!isReadFunction(fragment)) {
    throw new Error(`Function ${input.functionName} is not a read function`);
  }

  validateArgumentCount(fragment, input.args);

  return {
    kind: "read",
    contractName: input.artifact.contractName,
    address: input.address,
    functionName: fragment.name,
    args: input.args,
    inputs: fragment.inputs ?? [],
    outputs: fragment.outputs ?? []
  };
}

export function buildContractWriteCall(input: BuildContractWriteCallInput): ContractWriteCall {
  const fragment = findFunction(input.artifact.abi, input.functionName);
  if (isReadFunction(fragment)) {
    throw new Error(`Function ${input.functionName} is not a write function`);
  }

  validateArgumentCount(fragment, input.args);

  return {
    kind: "write",
    contractName: input.artifact.contractName,
    address: input.address,
    functionName: fragment.name,
    args: input.args,
    inputs: fragment.inputs ?? [],
    outputs: fragment.outputs ?? [],
    chainKey: input.chainKey,
    from: input.from,
    calldata: normalizeHex(input.calldata),
    valueWei: input.valueWei ?? 0n
  };
}

function findFunction(abi: unknown[], functionName: string): AbiFunction {
  const fragment = abi.filter(isAbiFunction).find((entry) => entry.name === functionName);
  if (!fragment) {
    throw new Error(`Function ${functionName} not found in ABI`);
  }
  return fragment;
}

function isAbiFunction(value: unknown): value is AbiFunction {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as { type?: unknown; name?: unknown };
  return entry.type === "function" && typeof entry.name === "string";
}

function isReadFunction(value: AbiFunction): boolean {
  return value.stateMutability === "view" || value.stateMutability === "pure";
}

function validateArgumentCount(fragment: AbiFunction, args: string[]): void {
  const expected = fragment.inputs?.length ?? 0;
  if (args.length !== expected) {
    throw new Error(`Function ${fragment.name} expects ${expected} arguments, received ${args.length}`);
  }
}

function normalizeHex(value: string): string {
  const normalized = value.startsWith("0x") ? value.toLowerCase() : `0x${value.toLowerCase()}`;
  if (!/^0x[0-9a-f]*$/.test(normalized)) {
    throw new Error(`Invalid calldata: ${value}`);
  }
  return normalized;
}
