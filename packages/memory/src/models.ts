export interface WalletMemoryRecord {
  label: string;
  address: string;
  signerType: string;
}

export interface ContractMemoryRecord {
  name: string;
  chainKey: string;
  address: string;
  transactionHash?: string;
  blockNumber?: bigint;
  artifactPath?: string;
}

export type RunStatus = "success" | "failed" | "cancelled";

export interface RunHistoryRecord {
  id: string;
  command: string;
  status: RunStatus;
  chainKey?: string;
  summary?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface WorkspacePreferences {
  defaultWallet?: string;
  defaultChain?: string;
  preferredChains: string[];
}

export interface EnvironmentProfile {
  name: string;
  defaultChain?: string;
  rpcOverrides: Record<string, string[]>;
}
