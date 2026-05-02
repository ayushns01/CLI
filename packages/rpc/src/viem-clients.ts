/**
 * Real viem-backed RPC clients.
 *
 * Bridges the deterministic core's NativeBalanceClient interface to a real
 * viem PublicClient that hits an HTTP RPC endpoint.
 *
 * The deterministic core stays viem-free; this is the seam where real
 * network access enters the system.
 */

import { createPublicClient, http } from "viem";
import type { Address } from "viem";

export interface BalanceClient {
  getBalance(address: string): Promise<bigint>;
}

export interface ViemBalanceClientOptions {
  rpcUrl: string;
  timeoutMs?: number;
}

export function createViemBalanceClient(options: ViemBalanceClientOptions): BalanceClient {
  const client = createPublicClient({
    transport: http(options.rpcUrl, { timeout: options.timeoutMs ?? 10_000 })
  });

  return {
    async getBalance(address: string): Promise<bigint> {
      return client.getBalance({ address: address as Address });
    }
  };
}
