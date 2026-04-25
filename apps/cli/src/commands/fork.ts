import type { ForkSession } from "../../../../packages/debug/src/fork.ts";

export function renderForkSession(session: ForkSession): string {
  return [
    `fork: ${session.id}`,
    `chain: ${session.chainKey}`,
    `rpc: ${session.rpcUrl}`,
    `sourceRpc: ${session.sourceRpcUrl}`,
    `block: ${session.blockNumber?.toString() ?? "latest"}`,
    `port: ${session.port.toString()}`
  ].join("\n");
}
