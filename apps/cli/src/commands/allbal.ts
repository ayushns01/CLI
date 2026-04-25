import { renderBalanceResult } from "./balance.ts";
import type { NativeBalanceResult } from "../../../../packages/tx/src/balance.ts";

export function renderAllBalancesResult(results: NativeBalanceResult[]): string {
  return results.map(renderBalanceResult).join("\n\n");
}
