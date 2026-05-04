import { readFileSync } from "node:fs";
import path from "node:path";

export type ChainEnvironment = "mainnet" | "testnet";

export interface ChainMetadata {
  key: string;
  name: string;
  id: number;
  environment: ChainEnvironment;
  aliases?: string[];
  nativeCurrency: {
    symbol: string;
    decimals: number;
  };
  explorerUrl: string;
  verifierApiUrl?: string;
  rpcUrls: string[];
}

export interface ChainRegistry {
  all(): ChainMetadata[];
  getById(id: number): ChainMetadata;
  getByName(nameOrAlias: string): ChainMetadata;
}

const defaultConfigDir = path.join(process.cwd(), "configs", "chains");

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function loadChainFile(filePath: string): ChainMetadata[] {
  return JSON.parse(readFileSync(filePath, "utf8")) as ChainMetadata[];
}

export function loadBuiltInChains(configDir = defaultConfigDir): ChainMetadata[] {
  return [
    ...loadChainFile(path.join(configDir, "mainnet.json")),
    ...loadChainFile(path.join(configDir, "testnet.json"))
  ];
}

export function createChainRegistry(chains: ChainMetadata[]): ChainRegistry {
  const byId = new Map<number, ChainMetadata>();
  const byName = new Map<string, ChainMetadata>();

  for (const chain of chains) {
    byId.set(chain.id, chain);

    const names = [chain.key, chain.name, ...(chain.aliases ?? [])];
    for (const name of names) {
      byName.set(normalizeName(name), chain);
    }
  }

  return {
    all: () => [...chains],
    getById: (id: number) => {
      const chain = byId.get(id);
      if (!chain) {
        throw new Error(`Unsupported chain ID: ${id}`);
      }
      return chain;
    },
    getByName: (nameOrAlias: string) => {
      const chain = byName.get(normalizeName(nameOrAlias));
      if (!chain) {
        throw new Error(`Unsupported chain: ${nameOrAlias}`);
      }
      return chain;
    }
  };
}
