import type { GasEstimateResult } from "../../../../../../packages/tx/src/gas.ts";

export function renderGasEstimateResult(result: GasEstimateResult): string {
  return [
    `estimated cost: ${result.formatted}`,
    `wei: ${result.totalWei.toString()}`
  ].join("\n");
}
