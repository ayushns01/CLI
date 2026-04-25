import { benchmarkProvider } from "./benchmark.ts";

export type RpcFailureKind = "timeout" | "rate-limit" | "bad-response" | "unknown";

export interface RpcProvider {
  name: string;
  url: string;
  measureLatency(): Promise<number>;
}

export interface RpcManager {
  selectProvider(excludedProviderNames?: Set<string>): Promise<RpcProvider>;
  executeRead<T>(operation: (provider: RpcProvider) => Promise<T>): Promise<T>;
}

export class RpcProviderError extends Error {
  readonly kind: RpcFailureKind;

  constructor(kind: RpcFailureKind, message: string) {
    super(message);
    this.name = "RpcProviderError";
    this.kind = kind;
  }
}

export function createRpcManager(providers: RpcProvider[]): RpcManager {
  if (providers.length === 0) {
    throw new Error("At least one RPC provider is required");
  }

  return {
    async selectProvider(excludedProviderNames = new Set<string>()) {
      const benchmarks = await Promise.all(
        providers
          .filter((provider) => !excludedProviderNames.has(provider.name))
          .map((provider) => benchmarkProvider(provider))
      );

      const healthy = benchmarks
        .filter((benchmark) => benchmark.healthy)
        .sort((left, right) => left.latencyMs - right.latencyMs);

      const selected = healthy[0]?.provider;
      if (!selected) {
        throw new Error("No healthy RPC provider available");
      }

      return selected;
    },
    async executeRead<T>(operation: (provider: RpcProvider) => Promise<T>): Promise<T> {
      const attemptedProviders = new Set<string>();
      let lastError: unknown;

      while (attemptedProviders.size < providers.length) {
        const provider = await this.selectProvider(attemptedProviders);
        attemptedProviders.add(provider.name);

        try {
          return await operation(provider);
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError instanceof Error ? lastError : new Error("RPC read failed");
    }
  };
}

export function classifyRpcError(error: unknown): RpcFailureKind {
  if (error instanceof RpcProviderError) {
    return error.kind;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }

  if (message.includes("429") || message.includes("rate") || message.includes("too many requests")) {
    return "rate-limit";
  }

  if (message.includes("invalid json") || message.includes("bad response")) {
    return "bad-response";
  }

  return "unknown";
}
