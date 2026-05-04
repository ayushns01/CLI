import { existsSync, readFileSync } from "node:fs";

import { createChainRegistry, loadBuiltInChains } from "../../../packages/chains/src/index.ts";
import type { ChainMetadata, ChainRegistry } from "../../../packages/chains/src/index.ts";
import {
  getDefaultConfigSearchPaths,
  loadLocalConfig,
  type ChainMindConfig
} from "../../../packages/config/src/index.ts";
import { createRealToolRegistry, type ToolRegistry } from "../../../packages/agent/src/tools.ts";
import { submitVerification, pollVerificationStatus } from "../../../packages/contracts/src/verify.ts";
import { renderRootHelp } from "./commands/root.ts";
import { renderBalanceResult } from "./commands/balance.ts";
import { renderAllBalancesResult } from "./commands/allbal.ts";
import { renderGasEstimateResult } from "./commands/gas/estimate.ts";
import { renderTraceReport } from "./commands/trace.ts";
import { renderDeploymentRecord, renderMultiChainDeploySummary } from "./commands/contract/deploy.ts";
import { readArtifactFile } from "./artifact-reader.ts";

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CliChainRegistry {
  all(): Array<{ key: string; environment: string }>;
  getByName(nameOrAlias: string): ChainMetadata & { verifierApiUrl?: string };
}

export interface CliDependencies {
  toolRegistry: Pick<ToolRegistry, "executeTool">;
  chainRegistry: CliChainRegistry;
}

export interface CliDependencyOptions {
  projectRoot?: string;
  environment?: string;
}

export function createDefaultCliDependencies(options: CliDependencyOptions = {}): CliDependencies {
  const config = loadWorkspaceConfig(options.projectRoot ?? process.cwd());
  const chains = applyWorkspaceChainConfig(
    loadBuiltInChains(),
    config,
    options.environment ?? process.env.CHAINMIND_ENV
  );
  const chainRegistry = createChainRegistry(chains);
  return {
    chainRegistry,
    toolRegistry: createRealToolRegistry({ chainRegistry })
  };
}

export async function runCli(
  args: string[],
  deps: CliDependencies = createDefaultCliDependencies()
): Promise<CliResult> {
  try {
    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
      return ok(renderRootHelp());
    }

    const [command, subcommand, ...rest] = args;

    if (command === "balance") {
      const options = parseOptions(args.slice(1));
      const result = await deps.toolRegistry.executeTool("balance", {
        chainKey: requiredOption(options, "chain"),
        address: requiredOption(options, "address")
      });
      return ok(renderBalanceToolResult(result));
    }

    if (command === "allbal") {
      const options = parseOptions(args.slice(1));
      const chainKeys = options.testnet
        ? deps.chainRegistry.all().filter((chain) => chain.environment === "testnet").map((chain) => chain.key)
        : parseCsvOption(options.chains);
      const result = await deps.toolRegistry.executeTool("balances_multi", {
        address: requiredOption(options, "address"),
        ...(chainKeys.length > 0 ? { chainKeys } : {})
      });
      return ok(renderAllBalancesToolResult(result));
    }

    if (command === "gas" && subcommand === "estimate") {
      const options = parseOptions(rest);
      const result = await deps.toolRegistry.executeTool("estimate_gas", {
        chainKey: requiredOption(options, "chain"),
        from: requiredOption(options, "from"),
        to: requiredOption(options, "to"),
        data: options.data ?? "0x",
        valueWei: options["value-wei"] ?? "0"
      });
      return ok(renderGasToolResult(result));
    }

    if (command === "simulate") {
      const options = parseOptions(args.slice(1));
      const result = await deps.toolRegistry.executeTool("simulate_tx", {
        chainKey: requiredOption(options, "chain"),
        from: requiredOption(options, "from"),
        to: requiredOption(options, "to"),
        data: options.data ?? "0x",
        valueWei: options["value-wei"] ?? "0"
      });
      return ok(renderSimulationToolResult(result));
    }

    if (command === "trace") {
      const options = parseOptions(args.slice(1));
      const result = await deps.toolRegistry.executeTool("trace_tx", {
        chainKey: requiredOption(options, "chain"),
        txHash: requiredOption(options, "tx")
      });
      return ok(renderTraceToolResult(result));
    }

    if (command === "deploy" || (command === "contract" && subcommand === "deploy")) {
      const options = parseOptions(command === "deploy" ? args.slice(1) : rest);
      if (!options["confirm-broadcast"]) {
        return fail("deploy_contract requires --confirm-broadcast because it signs and broadcasts a real transaction");
      }
      const deployInput = await resolveDeployInput(options);
      const chainOption = requiredOption(options, "chain");
      const chainKeys = chainOption.split(",").map((k) => k.trim()).filter(Boolean);

      if (chainKeys.length === 1) {
        const result = await deps.toolRegistry.executeTool("deploy_contract", {
          chainKey: chainKeys[0],
          bytecode: deployInput.bytecode,
          privateKey: requiredOption(options, "private-key"),
          ...(options["value-wei"] ? { valueWei: options["value-wei"] } : {})
        });
        const record = extractDeployRecord(result, deployInput.contractName, chainKeys[0]);
        let output = renderDeploymentRecord(record);
        if (options.verify) {
          const verifyOutput = await runVerification(record.address, chainKeys[0], options, deps);
          output += `\n${verifyOutput}`;
        }
        return ok(output);
      }

      const privateKey = requiredOption(options, "private-key");
      const chainResults = await Promise.allSettled(
        chainKeys.map(async (chainKey) => {
          const result = await deps.toolRegistry.executeTool("deploy_contract", {
            chainKey,
            bytecode: deployInput.bytecode,
            privateKey,
            ...(options["value-wei"] ? { valueWei: options["value-wei"] } : {})
          });
          return { chainKey, record: extractDeployRecord(result, deployInput.contractName, chainKey) };
        })
      );

      const rows: Array<{ chainKey: string; address?: string; txHash?: string; error?: string; verifyStatus?: string }> = [];
      for (let i = 0; i < chainResults.length; i++) {
        const settled = chainResults[i];
        const chainKey = chainKeys[i];
        if (settled.status === "fulfilled") {
          const { record } = settled.value;
          let verifyStatus: string | undefined;
          if (options.verify) {
            verifyStatus = await runVerification(record.address, chainKey, options, deps);
          }
          rows.push({ chainKey, address: record.address, txHash: record.transactionHash, verifyStatus });
        } else {
          const message = settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
          rows.push({ chainKey, error: message });
        }
      }
      return ok(renderMultiChainDeploySummary(deployInput.contractName, rows));
    }

    if (command === "verify") {
      const options = parseOptions(args.slice(1));
      const chainKey = requiredOption(options, "chain");
      const address = requiredOption(options, "address");
      const output = await runVerification(address, chainKey, options, deps);
      return ok(output);
    }

    return fail(`Command '${args.join(" ")}' is not implemented yet.`);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

function parseOptions(args: string[]): Record<string, string | true> {
  const options: Record<string, string | true> = {};

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = args[index + 1];
    if (next === undefined || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index++;
    }
  }

  return options;
}

function loadWorkspaceConfig(projectRoot: string): ChainMindConfig {
  const configPath = getDefaultConfigSearchPaths(projectRoot).find((candidate) => existsSync(candidate));
  return configPath ? loadLocalConfig(configPath) : {};
}

function applyWorkspaceChainConfig(
  chains: ChainMetadata[],
  config: ChainMindConfig,
  environmentName?: string
): ChainMetadata[] {
  const environmentOverrides = environmentName
    ? config.environments?.[environmentName]?.rpcOverrides
    : undefined;
  const rpcOverrides = {
    ...(config.rpcOverrides ?? {}),
    ...(environmentOverrides ?? {})
  };

  return chains.map((chain) => {
    const override = findRpcOverride(chain, rpcOverrides);
    const aliases = applyConfigAliases(chain, config);
    return {
      ...chain,
      aliases,
      ...(override && override.length > 0 ? { rpcUrls: [...override] } : {})
    };
  });
}

function findRpcOverride(
  chain: ChainMetadata,
  overrides: Record<string, string[]>
): string[] | undefined {
  const keys = [chain.key, chain.name, ...(chain.aliases ?? [])].map(normalizeChainKey);
  const match = Object.entries(overrides).find(([key]) => keys.includes(normalizeChainKey(key)));
  return match?.[1];
}

function normalizeChainKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function applyConfigAliases(chain: ChainMetadata, config: ChainMindConfig): string[] | undefined {
  const aliases = new Set(chain.aliases ?? []);
  for (const [alias, target] of Object.entries(config.chainAliases ?? {})) {
    if (normalizeChainKey(target) === normalizeChainKey(chain.key)) {
      aliases.add(alias);
    }
  }
  return aliases.size > 0 ? [...aliases] : undefined;
}

function requiredOption(options: Record<string, string | true>, name: string): string {
  const value = options[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required option --${name}`);
  }
  return value;
}

function parseCsvOption(value: string | true | undefined): string[] {
  return typeof value === "string"
    ? value.split(",").map((entry) => entry.trim()).filter(Boolean)
    : [];
}

async function resolveDeployInput(options: Record<string, string | true>): Promise<{
  bytecode: string;
  contractName: string;
}> {
  if (typeof options.artifact === "string" && options.artifact.trim() !== "") {
    const artifact = await readArtifactFile(options.artifact);
    return {
      bytecode: artifact.bytecode,
      contractName: artifact.contractName
    };
  }

  if (typeof options.bytecode === "string" && options.bytecode.trim() !== "") {
    return {
      bytecode: options.bytecode,
      contractName: "Contract"
    };
  }

  throw new Error("Missing deploy input: provide --bytecode or --artifact");
}

function renderBalanceToolResult(result: unknown): string {
  const row = result as { chainKey: string; address: string; balance: string; formatted: string };
  return renderBalanceResult({
    chainKey: row.chainKey,
    address: row.address,
    balanceWei: BigInt(row.balance),
    formatted: row.formatted
  });
}

function renderAllBalancesToolResult(result: unknown): string {
  const output = result as {
    address: string;
    balances: Array<{ chainKey: string; balance: string; formatted: string }>;
  };
  return renderAllBalancesResult(
    output.balances.map((row) => ({
      chainKey: row.chainKey,
      address: output.address,
      balanceWei: BigInt(row.balance),
      formatted: row.formatted
    }))
  );
}

function renderGasToolResult(result: unknown): string {
  const output = result as {
    gasLimit: string;
    maxFeePerGasWei: string;
    maxPriorityFeePerGasWei?: string;
    estimatedCostWei: string;
    formatted: string;
  };
  return [
    `gasLimit: ${output.gasLimit}`,
    `maxFeePerGasWei: ${output.maxFeePerGasWei}`,
    ...(output.maxPriorityFeePerGasWei ? [`maxPriorityFeePerGasWei: ${output.maxPriorityFeePerGasWei}`] : []),
    renderGasEstimateResult({
      totalWei: BigInt(output.estimatedCostWei),
      formatted: output.formatted
    })
  ].join("\n");
}

function renderSimulationToolResult(result: unknown): string {
  const output = result as {
    success: boolean;
    chainKey: string;
    gasUsed?: string;
    revertReason?: string;
    stateChanges?: string[];
  };
  if (!output.success) {
    return [`chain: ${output.chainKey}`, "simulation: reverted", `reason: ${output.revertReason}`].join("\n");
  }
  return [
    `chain: ${output.chainKey}`,
    "simulation: success",
    `gasUsed: ${output.gasUsed}`,
    ...(output.stateChanges ?? []).map((change) => `stateChange: ${change}`)
  ].join("\n");
}

function renderTraceToolResult(result: unknown): string {
  const output = result as {
    chainKey: string;
    txHash: string;
    callStack: Array<{
      depth: number;
      type: string;
      from: string;
      to?: string;
      input: string;
      decodedCall: string;
      valueWei?: string;
      gasUsed?: string;
      error?: string;
      revertData?: string;
    }>;
  };
  return renderTraceReport({
    chainKey: output.chainKey,
    txHash: output.txHash,
    callStack: output.callStack.map((frame) => ({
      ...frame,
      valueWei: frame.valueWei === undefined ? undefined : BigInt(frame.valueWei),
      gasUsed: frame.gasUsed === undefined ? undefined : BigInt(frame.gasUsed)
    }))
  });
}

function extractDeployRecord(
  result: unknown,
  contractName: string,
  chainKey: string
): { contractName: string; chainKey: string; address: string; transactionHash: string; blockNumber: bigint } {
  const output = result as {
    chainKey?: string;
    contractAddress: string;
    transactionHash: string;
    blockNumber: string;
  };
  return {
    contractName,
    chainKey: output.chainKey ?? chainKey,
    address: output.contractAddress,
    transactionHash: output.transactionHash,
    blockNumber: BigInt(output.blockNumber)
  };
}

async function runVerification(
  contractAddress: string,
  chainKey: string,
  options: Record<string, string | true>,
  deps: CliDependencies
): Promise<string> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return "verify: skipped (ETHERSCAN_API_KEY not set)";
  }

  const sourceFile = typeof options.source === "string" ? options.source : undefined;
  if (!sourceFile) {
    return "verify: skipped (--source <file.sol> required)";
  }

  const contractName = typeof options.name === "string" ? options.name : "Contract";
  const compilerVersion = typeof options.compiler === "string" ? options.compiler : "v0.8.20+commit.a1b79de6";

  let chain: ChainMetadata;
  try {
    chain = deps.chainRegistry.getByName(chainKey);
  } catch {
    return `verify: skipped (unknown chain ${chainKey})`;
  }

  if (!chain.verifierApiUrl) {
    return `verify: skipped (no verifier configured for ${chainKey})`;
  }

  let sourceCode: string;
  try {
    sourceCode = readFileSync(sourceFile, "utf8");
  } catch {
    return `verify: skipped (could not read ${sourceFile})`;
  }

  try {
    const guid = await submitVerification({
      apiUrl: chain.verifierApiUrl,
      apiKey,
      contractAddress,
      sourceCode,
      contractName,
      compilerVersion,
      optimizationUsed: options.optimization === "true" || options.optimization === true
    });

    const verifyResult = await pollVerificationStatus(guid, chain.verifierApiUrl, apiKey);
    const explorerLink = `${chain.explorerUrl}/address/${contractAddress}#code`;

    if (verifyResult.status === "success") {
      return `verify: ✓ verified  ${explorerLink}`;
    }
    if (verifyResult.status === "pending") {
      return `verify: pending (check manually: ${explorerLink})`;
    }
    return `verify: ✗ failed — ${verifyResult.message}`;
  } catch (err) {
    return `verify: ✗ error — ${err instanceof Error ? err.message : String(err)}`;
  }
}

function ok(stdout: string): CliResult {
  return { stdout, stderr: "", exitCode: 0 };
}

function fail(stderr: string): CliResult {
  return { stdout: "", stderr, exitCode: 1 };
}
