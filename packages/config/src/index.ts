import { readFileSync } from "node:fs";
import path from "node:path";

import type { ChainMetadata, ChainRegistry } from "../../chains/src/index.ts";

export interface ChainMindConfig {
  defaultChain?: string;
  rpcOverrides?: Record<string, string[]>;
}

export function loadLocalConfig(configPath: string): ChainMindConfig {
  return JSON.parse(readFileSync(configPath, "utf8")) as ChainMindConfig;
}

export function resolveDefaultChain(config: ChainMindConfig, registry: ChainRegistry): ChainMetadata {
  if (!config.defaultChain) {
    throw new Error("No default chain configured");
  }

  return registry.getByName(config.defaultChain);
}

export function getDefaultConfigSearchPaths(projectRoot: string): string[] {
  return [
    path.join(projectRoot, "chainmind.config.json"),
    path.join(projectRoot, ".chainmind.yaml")
  ];
}
