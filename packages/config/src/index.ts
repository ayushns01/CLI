import { readFileSync } from "node:fs";
import path from "node:path";

import type { ChainMetadata, ChainRegistry } from "../../chains/src/index.ts";

export interface ChainMindConfig {
  defaultChain?: string;
  defaultWallet?: string;
  preferredChains?: string[];
  rpcOverrides?: Record<string, string[]>;
  chainAliases?: Record<string, string>;
  knownAddresses?: Record<string, Record<string, string>>;
  environments?: Record<string, ChainMindEnvironmentConfig>;
}

export interface ChainMindEnvironmentConfig {
  defaultChain?: string;
  rpcOverrides?: Record<string, string[]>;
  knownAddresses?: Record<string, Record<string, string>>;
}

export function loadLocalConfig(configPath: string): ChainMindConfig {
  const content = readFileSync(configPath, "utf8");
  if (configPath.endsWith(".yaml") || configPath.endsWith(".yml")) {
    return parseYamlSubset(content) as ChainMindConfig;
  }

  return JSON.parse(content) as ChainMindConfig;
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

interface YamlLine {
  indent: number;
  text: string;
}

function parseYamlSubset(content: string): unknown {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, ""))
    .filter((line) => line.trim().length > 0)
    .map((line) => ({
      indent: line.match(/^ */)?.[0].length ?? 0,
      text: line.trim()
    }));

  return parseBlock(lines, 0, 0).value;
}

function parseBlock(lines: YamlLine[], start: number, indent: number): { value: unknown; next: number } {
  const first = lines[start];
  if (first?.indent === indent && first.text.startsWith("- ")) {
    return parseList(lines, start, indent);
  }

  return parseMap(lines, start, indent);
}

function parseMap(lines: YamlLine[], start: number, indent: number): { value: Record<string, unknown>; next: number } {
  const value: Record<string, unknown> = {};
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line.indent < indent) {
      break;
    }
    if (line.indent > indent) {
      throw new Error(`Invalid YAML indentation near: ${line.text}`);
    }
    if (line.text.startsWith("- ")) {
      break;
    }

    const separator = line.text.indexOf(":");
    if (separator === -1) {
      throw new Error(`Invalid YAML mapping entry: ${line.text}`);
    }

    const key = line.text.slice(0, separator).trim();
    const rawValue = line.text.slice(separator + 1).trim();

    if (rawValue.length > 0) {
      value[key] = parseScalar(rawValue);
      index += 1;
      continue;
    }

    const nextLine = lines[index + 1];
    if (!nextLine || nextLine.indent <= line.indent) {
      value[key] = {};
      index += 1;
      continue;
    }

    const parsed = parseBlock(lines, index + 1, nextLine.indent);
    value[key] = parsed.value;
    index = parsed.next;
  }

  return { value, next: index };
}

function parseList(lines: YamlLine[], start: number, indent: number): { value: unknown[]; next: number } {
  const value: unknown[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    if (line.indent !== indent || !line.text.startsWith("- ")) {
      break;
    }

    const item = line.text.slice(2).trim();
    value.push(parseScalar(item));
    index += 1;
  }

  return { value, next: index };
}

function parseScalar(value: string): string | boolean | null {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (value === "null") {
    return null;
  }
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
