export type TransactionRiskLevel = "low" | "medium" | "high";

export interface TransactionRequest {
  chainKey: string;
  from: string;
  to: string;
  data: string;
  valueWei: bigint;
}

export interface TransactionPreview extends TransactionRequest {
  gasLimit: bigint;
  riskLevel: TransactionRiskLevel;
  requiresApproval: boolean;
  description?: string;
}

export interface BuildTransactionPreviewInput extends TransactionRequest {
  gasLimit: bigint;
  riskLevel: TransactionRiskLevel;
  description?: string;
}

export function buildTransactionPreview(input: BuildTransactionPreviewInput): TransactionPreview {
  return {
    chainKey: input.chainKey,
    from: input.from,
    to: input.to,
    data: normalizeHex(input.data),
    valueWei: input.valueWei,
    gasLimit: input.gasLimit,
    riskLevel: input.riskLevel,
    requiresApproval: true,
    description: input.description
  };
}

function normalizeHex(value: string): string {
  const normalized = value.startsWith("0x") ? value.toLowerCase() : `0x${value.toLowerCase()}`;
  if (!/^0x[0-9a-f]*$/.test(normalized)) {
    throw new Error(`Invalid calldata: ${value}`);
  }
  return normalized;
}
