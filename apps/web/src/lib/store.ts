export interface RunRow {
  id: string;
  command: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  chainKey?: string;
}

export interface AlertRow {
  id: string;
  watcherId: string;
  type: string;
  message: string;
  severity: string;
  triggeredAt: string;
  resolvedAt?: string;
}

export interface ContractRow {
  name: string;
  address: string;
  chainKey: string;
  deployedAt?: string;
}
