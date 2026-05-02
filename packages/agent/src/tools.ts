/**
 * Tool registry and descriptors.
 * Defines the available tools the agent can dispatch.
 * Tools wrap the existing deterministic packages.
 */

import type { ToolDescriptor } from "./types.ts";
import type { ChainRegistry } from "../../chains/src/index.ts";
import { getNativeBalance, getNativeBalancesAcrossChains } from "../../tx/src/balance.ts";
import { simulateTransaction } from "../../tx/src/simulate.ts";
import { createViemBalanceClient, createViemSimulationClient } from "../../rpc/src/viem-clients.ts";

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

  return registry;
}
