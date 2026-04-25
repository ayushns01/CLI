export interface ContractAbiEntry {
  type: string;
  name?: string;
  inputs?: Array<{ name?: string; type: string }>;
  outputs?: Array<{ name?: string; type: string }>;
}

export interface ContractArtifact {
  contractName: string;
  abi: ContractAbiEntry[];
  bytecode: string;
}

export interface ArtifactParseOptions {
  contractName?: string;
}

export function parseContractArtifact(rawArtifact: unknown, options: ArtifactParseOptions = {}): ContractArtifact {
  if (!isRecord(rawArtifact)) {
    throw new Error("Artifact must be an object");
  }

  const abi = rawArtifact.abi;
  if (!Array.isArray(abi)) {
    throw new Error("Artifact ABI is required");
  }

  const bytecode = extractBytecode(rawArtifact.bytecode);
  if (!bytecode) {
    throw new Error("Artifact bytecode is required");
  }

  return {
    contractName: readString(rawArtifact.contractName) ?? options.contractName ?? "UnknownContract",
    abi: abi as ContractAbiEntry[],
    bytecode
  };
}

function extractBytecode(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return normalizeHex(value);
  }

  if (isRecord(value) && typeof value.object === "string" && value.object.length > 0) {
    return normalizeHex(value.object);
  }

  return undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeHex(value: string): string {
  const normalized = value.startsWith("0x") ? value.toLowerCase() : `0x${value.toLowerCase()}`;
  if (!/^0x[0-9a-f]+$/.test(normalized)) {
    throw new Error(`Invalid artifact bytecode: ${value}`);
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
