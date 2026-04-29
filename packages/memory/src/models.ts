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

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType = "wallet_state_change" | "contract_event" | "policy_action";

export interface AlertRecord {
  id: string;
  type: AlertType;
  watcherId: string;
  chainKey?: string;
  address?: string;
  message: string;
  severity: AlertSeverity;
  dataJson: string;
  triggeredAt: string;
  resolvedAt?: string;
}
