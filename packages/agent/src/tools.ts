/**
 * Tool registry and descriptors.
 * Defines the available tools the agent can dispatch.
 * Tools wrap the existing deterministic packages.
 */

import type { ToolDescriptor } from "./types.ts";
import type { ChainRegistry } from "../../chains/src/index.ts";
import { getNativeBalance, getNativeBalancesAcrossChains } from "../../tx/src/balance.ts";
import { simulateTransaction } from "../../tx/src/simulate.ts";
import { estimateGasCost } from "../../tx/src/gas.ts";
import { fetchTransactionTrace, buildTraceReport } from "../../debug/src/trace.ts";
import {
  createViemBalanceClient,
  createViemContractClient,
  createViemDeployClient,
  createViemGasClient,
  createViemSimulationClient,
  createViemTraceClient
} from "../../rpc/src/viem-clients.ts";
import { listContractFunctions } from "../../contracts/src/studio.ts";

/**
 * Create a tool registry.
 * Maps tool names to their descriptors and execution functions.
 */
export class ToolRegistry {
  private tools: Map<string, ToolDescriptor> = new Map();

  /**
   * Register a tool.
   */
  register(descriptor: ToolDescriptor): void {
    this.tools.set(descriptor.name, descriptor);
  }

  /**
   * Get a tool by name.
   */
  getTool(name: string): ToolDescriptor | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools.
   */
  getTools(): ToolDescriptor[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool is registered.
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Execute a tool by name with args.
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return tool.execute(args);
  }
}

/**
 * Create a default tool registry with standard ChainMind tools.
 */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Balance tools
  registry.register({
    name: "balance",
    description: "Get native balance for an address on a chain",
    approvalLevel: "read",
    isHighRisk: false,
    execute: async (args) => {
      // Placeholder: wraps getNativeBalance from @chainmind/tx
      return { chainKey: args.chainKey, address: args.address, balance: "0" };
    }
  });

  registry.register({
    name: "balances_multi",
    description: "Get native balance for an address across multiple chains",
    approvalLevel: "read",
    isHighRisk: false,
    execute: async (args) => {
      // Placeholder: wraps getNativeBalancesAcrossChains from @chainmind/tx
      return { address: args.address, balances: [] };
    }
  });

  // Contract tools
  registry.register({
    name: "deploy_contract",
    description: "Deploy a contract from artifact",
    approvalLevel: "broadcast",
    isHighRisk: false,
    execute: async (args) => {
      // Placeholder: wraps deployer from @chainmind/contracts
      return { txHash: "", address: "" };
    }
  });

  registry.register({
    name: "interact_contract",
    description: "Call a contract function",
    approvalLevel: "broadcast",
    isHighRisk: false,
    execute: async (args) => {
      // Placeholder: wraps studio from @chainmind/contracts
      return { result: "" };
    }
  });

  // Transaction tools
  registry.register({
    name: "estimate_gas",
    description: "Estimate gas cost for a transaction",
    approvalLevel: "simulate",
    isHighRisk: false,
    execute: async (args) => {
      // Placeholder: wraps estimateGasCost from @chainmind/tx
      return { estimatedGas: "0", estimatedCost: "0" };
    }
  });

  registry.register({
    name: "simulate_tx",
    description: "Simulate a transaction before broadcasting",
    approvalLevel: "simulate",
    isHighRisk: false,
    execute: async (args) => {
      // Placeholder: wraps simulate from @chainmind/tx
      return { success: true };
    }
  });

  // Debug tools
  registry.register({
    name: "trace_tx",
    description: "Get transaction trace and execution details",
    approvalLevel: "read",
    isHighRisk: false,
    execute: async (args) => {
      // Placeholder: wraps trace from @chainmind/debug
      return { trace: [] };
    }
  });

  registry.register({
    name: "fork_chain",
    description: "Create a local fork of a chain",
    approvalLevel: "read",
    isHighRisk: false,
    execute: async (args) => {
      // Placeholder: wraps fork from @chainmind/debug
      return { forkId: "" };
    }
  });

  // High-risk operations (typically denied in production)
  registry.register({
    name: "drain_balance",
    description: "Send all balance to an address (HIGH RISK)",
    approvalLevel: "broadcast",
    isHighRisk: true,
    execute: async (args) => {
      throw new Error("drain_balance is not allowed");
    }
  });

  registry.register({
    name: "force_withdraw",
    description: "Force withdraw from a contract (HIGH RISK)",
    approvalLevel: "broadcast",
    isHighRisk: true,
    execute: async (args) => {
      throw new Error("force_withdraw is not allowed");
    }
  });

  return registry;
}

/**
 * Build a tool registry whose `balance` and `balances_multi` tools hit real
 * RPC endpoints via viem. Other tools fall through to the placeholder
 * implementations from createDefaultToolRegistry until their own real impls
 * land.
 */
export function createRealToolRegistry(deps: { chainRegistry: ChainRegistry }): ToolRegistry {
  const registry = createDefaultToolRegistry();
  const { chainRegistry } = deps;

  registry.register({
    name: "balance",
    description: "Get native balance for an address on a chain",
    approvalLevel: "read",
    isHighRisk: false,
    execute: async (args) => {
      const chainKey = String(args.chainKey);
      const address = String(args.address);
      const chain = chainRegistry.getByName(chainKey);
      const result = await getNativeBalance({
        chainKey: chain.key,
        address,
        symbol: chain.nativeCurrency.symbol,
        decimals: chain.nativeCurrency.decimals,
        client: createViemBalanceClient({ rpcUrl: chain.rpcUrls[0] })
      });
      return {
        chainKey: result.chainKey,
        address: result.address,
        balance: result.balanceWei.toString(),
        formatted: result.formatted
      };
    }
  });

  registry.register({
    name: "balances_multi",
    description: "Get native balance for an address across multiple chains",
    approvalLevel: "read",
    isHighRisk: false,
    execute: async (args) => {
      const address = String(args.address);
      const chainKeys = Array.isArray(args.chainKeys)
        ? (args.chainKeys as string[])
        : chainRegistry.all().map((c) => c.key);
      const chains = chainKeys.map((key) => {
        const chain = chainRegistry.getByName(key);
        return { key: chain.key, symbol: chain.nativeCurrency.symbol, decimals: chain.nativeCurrency.decimals };
      });
      const results = await getNativeBalancesAcrossChains({
        address,
        chains,
        createClient: (chainKey: string) => {
          const chain = chainRegistry.getByName(chainKey);
          return createViemBalanceClient({ rpcUrl: chain.rpcUrls[0] });
        }
      });
      return {
        address,
        balances: results.map((r) => ({ chainKey: r.chainKey, balance: r.balanceWei.toString(), formatted: r.formatted }))
      };
    }
  });

  registry.register({
    name: "estimate_gas",
    description: "Estimate gas limit and fee for a transaction (real RPC eth_estimateGas + fee data)",
    approvalLevel: "simulate",
    isHighRisk: false,
    execute: async (args) => {
      const chainKey = String(args.chainKey);
      const chain = chainRegistry.getByName(chainKey);
      const valueWei = typeof args.valueWei === "bigint"
        ? args.valueWei
        : BigInt(args.valueWei !== undefined ? String(args.valueWei) : "0");
      const gasClient = createViemGasClient({ rpcUrl: chain.rpcUrls[0] });
      const data = await gasClient.estimate({
        from: String(args.from),
        to: String(args.to),
        data: typeof args.data === "string" ? args.data : "0x",
        valueWei
      });
      const cost = estimateGasCost({
        gasLimit: data.gasLimit,
        maxFeePerGasWei: data.maxFeePerGasWei,
        symbol: chain.nativeCurrency.symbol,
        decimals: chain.nativeCurrency.decimals
      });
      return {
        chainKey: chain.key,
        gasLimit: data.gasLimit.toString(),
        maxFeePerGasWei: data.maxFeePerGasWei.toString(),
        maxPriorityFeePerGasWei: data.maxPriorityFeePerGasWei?.toString(),
        estimatedCostWei: cost.totalWei.toString(),
        formatted: cost.formatted
      };
    }
  });

  registry.register({
    name: "simulate_tx",
    description: "Simulate a transaction before broadcasting (real RPC eth_call + eth_estimateGas)",
    approvalLevel: "simulate",
    isHighRisk: false,
    execute: async (args) => {
      const chainKey = String(args.chainKey);
      const chain = chainRegistry.getByName(chainKey);
      const request = {
        chainKey: chain.key,
        from: String(args.from),
        to: String(args.to),
        data: typeof args.data === "string" ? args.data : "0x",
        valueWei: typeof args.valueWei === "bigint"
          ? args.valueWei
          : BigInt(args.valueWei !== undefined ? String(args.valueWei) : "0")
      };
      const result = await simulateTransaction({
        request,
        client: createViemSimulationClient({ rpcUrl: chain.rpcUrls[0] })
      });
      if (result.success) {
        return {
          success: true,
          chainKey: chain.key,
          gasUsed: result.gasUsed.toString(),
          stateChanges: result.stateChanges
        };
      }
      return {
        success: false,
        chainKey: chain.key,
        revertReason: result.revertReason,
        revertData: result.revertData
      };
    }
  });

  registry.register({
    name: "trace_tx",
    description: "Get transaction trace and execution details (real RPC, receipt-based)",
    approvalLevel: "read",
    isHighRisk: false,
    execute: async (args) => {
      const chainKey = requireStringArg(args, "chainKey", "trace_tx");
      const chain = chainRegistry.getByName(chainKey);
      const txHash = requireHexArg(args, "txHash", "trace_tx");
      const trace = await fetchTransactionTrace({
        chainKey: chain.key,
        txHash,
        client: createViemTraceClient({ rpcUrl: chain.rpcUrls[0] })
      });
      const report = buildTraceReport(trace);
      return {
        chainKey: report.chainKey,
        txHash: report.txHash,
        callStack: report.callStack.map((frame) => ({
          depth: frame.depth,
          type: frame.type,
          from: frame.from,
          to: frame.to,
          input: frame.input,
          decodedCall: frame.decodedCall,
          valueWei: frame.valueWei?.toString(),
          gasUsed: frame.gasUsed?.toString(),
          error: frame.error,
          revertData: frame.revertData
        }))
      };
    }
  });

  registry.register({
    name: "interact_contract",
    description: "Call a contract function (real RPC read/write)",
    approvalLevel: "broadcast",
    isHighRisk: false,
    execute: async (args) => {
      const chainKey = requireStringArg(args, "chainKey", "interact_contract");
      const address = requireStringArg(args, "address", "interact_contract");
      const functionName = requireStringArg(args, "functionName", "interact_contract");
      const chain = chainRegistry.getByName(chainKey);
      const abi = parseAbiArg(args.abi);
      const functions = listContractFunctions(abi);
      const selectedFunction = functions.find((entry) => entry.name === functionName);
      if (!selectedFunction) {
        throw new Error(`Function ${functionName} not found in ABI`);
      }
      const rawArgs = Array.isArray(args.args) ? args.args : [];
      const client = createViemContractClient({ rpcUrl: chain.rpcUrls[0] });

      if (selectedFunction.kind === "read") {
        const result = await client.read({
          address,
          abi,
          functionName,
          args: rawArgs
        });
        return {
          chainKey: chain.key,
          address,
          functionName,
          result: serializeResult(result.result)
        };
      }

      const privateKey = requireStringArg(args, "privateKey", "interact_contract");
      const valueWei = typeof args.valueWei === "bigint"
        ? args.valueWei
        : args.valueWei !== undefined ? BigInt(String(args.valueWei)) : undefined;
      const result = await client.write({
        address,
        abi,
        functionName,
        args: rawArgs,
        privateKey,
        valueWei
      });
      return {
        chainKey: chain.key,
        txHash: result.transactionHash,
        blockNumber: result.blockNumber.toString()
      };
    }
  });

  registry.register({
    name: "deploy_contract",
    description: "Deploy a contract from bytecode (real RPC sign + broadcast). Requires privateKey arg.",
    approvalLevel: "broadcast",
    isHighRisk: false,
    execute: async (args) => {
      const chainKey = requireStringArg(args, "chainKey", "deploy_contract");
      const chain = chainRegistry.getByName(chainKey);
      const privateKey = requireStringArg(args, "privateKey", "deploy_contract");
      const bytecode = requireHexArg(args, "bytecode", "deploy_contract", {
        allowEmptyHex: false,
        emptyMessage: "deploy_contract requires non-empty bytecode"
      });
      const valueWei = typeof args.valueWei === "bigint"
        ? args.valueWei
        : args.valueWei !== undefined ? BigInt(String(args.valueWei)) : undefined;

      const deployClient = createViemDeployClient({ rpcUrl: chain.rpcUrls[0], privateKey });
      const result = await deployClient.deploy({ bytecode, valueWei });
      return {
        chainKey: chain.key,
        contractAddress: result.contractAddress,
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber.toString()
      };
    }
  });

  return registry;
}

function requireStringArg(
  args: Record<string, unknown>,
  name: string,
  toolName: string
): string {
  const value = args[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${toolName} requires a ${name} arg`);
  }
  return value.trim();
}

function requireHexArg(
  args: Record<string, unknown>,
  name: string,
  toolName: string,
  options?: { allowEmptyHex?: boolean; emptyMessage?: string }
): `0x${string}` {
  const raw = args[name];
  if (
    options?.allowEmptyHex === false &&
    (typeof raw !== "string" || raw.trim() === "" || raw.trim() === "0x")
  ) {
    throw new Error(options.emptyMessage ?? `${toolName} requires non-empty ${name}`);
  }
  const value = requireStringArg(args, name, toolName);
  if (!/^0x[0-9a-fA-F]*$/.test(value)) {
    throw new Error(`${toolName} requires ${name} to be hex`);
  }
  return value as `0x${string}`;
}

function parseAbiArg(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  }
  throw new Error("interact_contract requires an abi array or JSON string");
}

function serializeResult(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeResult);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeResult(entry)])
    );
  }
  return value;
}
