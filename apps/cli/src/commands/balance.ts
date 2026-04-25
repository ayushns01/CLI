import type { NativeBalanceResult } from "../../../../packages/tx/src/balance.ts";

export function renderBalanceResult(result: NativeBalanceResult): string {
  return [
    `chain: ${result.chainKey}`,
    `address: ${result.address}`,
    `balance: ${result.formatted}`,
    `wei: ${result.balanceWei.toString()}`
  ].join("\n");
}
