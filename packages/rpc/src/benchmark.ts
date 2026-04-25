import type { RpcProvider } from "./manager.ts";

export interface ProviderBenchmark {
  provider: RpcProvider;
  latencyMs: number;
  healthy: boolean;
  error?: unknown;
}

export async function benchmarkProvider(provider: RpcProvider): Promise<ProviderBenchmark> {
  try {
    const latencyMs = await provider.measureLatency();
    return {
      provider,
      latencyMs,
      healthy: true
    };
  } catch (error) {
    return {
      provider,
      latencyMs: Number.POSITIVE_INFINITY,
      healthy: false,
      error
    };
  }
}
