import { formatUnits } from "./format.ts";

export interface NativeBalanceClient {
  getBalance(address: string): Promise<bigint>;
}

export interface NativeBalanceRequest {
  chainKey: string;
  address: string;
  symbol: string;
  decimals: number;
  client: NativeBalanceClient;
}

export interface NativeBalanceResult {
  chainKey: string;
  address: string;
  balanceWei: bigint;
  formatted: string;
}

export interface BalanceChainConfig {
  key: string;
  symbol: string;
  decimals: number;
}

export async function getNativeBalance(request: NativeBalanceRequest): Promise<NativeBalanceResult> {
  const balanceWei = await request.client.getBalance(request.address);

  return {
    chainKey: request.chainKey,
    address: request.address,
    balanceWei,
    formatted: formatUnits(balanceWei, request.decimals, request.symbol)
  };
}

export async function getNativeBalancesAcrossChains(request: {
  address: string;
  chains: BalanceChainConfig[];
  createClient(chainKey: string): NativeBalanceClient;
}): Promise<NativeBalanceResult[]> {
  const balances: NativeBalanceResult[] = [];

  for (const chain of request.chains) {
    balances.push(
      await getNativeBalance({
        chainKey: chain.key,
        address: request.address,
        symbol: chain.symbol,
        decimals: chain.decimals,
        client: request.createClient(chain.key)
      })
    );
  }

  return balances;
}
