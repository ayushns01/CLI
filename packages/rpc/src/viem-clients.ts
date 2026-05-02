/**
 * Real viem-backed RPC clients.
 *
 * Bridges the deterministic core's NativeBalanceClient interface to a real
 * viem PublicClient that hits an HTTP RPC endpoint.
 *
 * The deterministic core stays viem-free; this is the seam where real
 * network access enters the system.
 */

import { createPublicClient, http, BaseError, ContractFunctionRevertedError } from "viem";
import type { Address, Hex } from "viem";

export interface BalanceClient {
  getBalance(address: string): Promise<bigint>;
}

export interface ViemClientOptions {
  rpcUrl: string;
  timeoutMs?: number;
}

export function createViemBalanceClient(options: ViemClientOptions): BalanceClient {
  const client = createPublicClient({
    transport: http(options.rpcUrl, { timeout: options.timeoutMs ?? 10_000 })
  });

  return {
    async getBalance(address: string): Promise<bigint> {
      return client.getBalance({ address: address as Address });
    }
  };
}

export interface SimulationRequest {
  chainKey: string;
  from: string;
  to: string;
  data: string;
  valueWei: bigint;
}

export interface SimulationSuccess {
  success: true;
  gasUsed: bigint;
  stateChanges: string[];
}

export interface SimulationFailure {
  success: false;
  revertData?: string;
}

export type RawSimulationResult = SimulationSuccess | SimulationFailure;

export interface SimulationClient {
  simulate(request: SimulationRequest): Promise<RawSimulationResult>;
}

/**
 * Build a viem-backed simulation client. Uses eth_call + eth_estimateGas to
 * dry-run a transaction without broadcasting. On revert, attempts to extract
 * the raw revert data so the deterministic core can decode the reason.
 */
export function createViemSimulationClient(options: ViemClientOptions): SimulationClient {
  const client = createPublicClient({
    transport: http(options.rpcUrl, { timeout: options.timeoutMs ?? 10_000 })
  });

  return {
    async simulate(request: SimulationRequest): Promise<RawSimulationResult> {
      try {
        const gasUsed = await client.estimateGas({
          account: request.from as Address,
          to: request.to as Address,
          data: request.data as Hex,
          value: request.valueWei
        });

        await client.call({
          account: request.from as Address,
          to: request.to as Address,
          data: request.data as Hex,
          value: request.valueWei
        });

        return { success: true, gasUsed, stateChanges: [] };
      } catch (err) {
        return { success: false, revertData: extractRevertData(err) };
      }
    }
  };
}

function extractRevertData(err: unknown): string | undefined {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError && reverted.data) {
      return reverted.data.errorName === "Error" ? reverted.raw : reverted.raw;
    }
    const raw = (err as unknown as { data?: string }).data;
    if (typeof raw === "string") return raw;
  }
  return undefined;
}
