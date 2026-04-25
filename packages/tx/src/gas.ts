import { formatUnits } from "./format.ts";

export interface GasEstimateRequest {
  gasLimit: bigint;
  maxFeePerGasWei: bigint;
  symbol: string;
  decimals: number;
}

export interface GasEstimateResult {
  totalWei: bigint;
  formatted: string;
}

export function estimateGasCost(request: GasEstimateRequest): GasEstimateResult {
  const totalWei = request.gasLimit * request.maxFeePerGasWei;

  return {
    totalWei,
    formatted: formatUnits(totalWei, request.decimals, request.symbol)
  };
}
