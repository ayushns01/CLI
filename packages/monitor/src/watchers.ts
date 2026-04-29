/**
 * Wallet and contract event watchers.
 * AI proposes monitoring rules; these deterministic watchers execute the checks.
 * All state is injected via interfaces so tests never touch real RPC.
 */

import type { AlertSeverity, AlertType } from "../../memory/src/models.ts";

export interface RpcClient {
  getBalance(address: string, chainKey: string): Promise<string>;
  getLogs(address: string, chainKey: string, fromBlock: bigint): Promise<EventLog[]>;
}

export interface EventLog {
  blockNumber: bigint;
  transactionHash: string;
  topics: string[];
  data: string;
}

export interface AlertPayload {
  type: AlertType;
  watcherId: string;
  chainKey: string;
  address: string;
  message: string;
  severity: AlertSeverity;
  data: Record<string, unknown>;
}

export type WatcherResult =
  | { triggered: false }
  | { triggered: true; alert: AlertPayload };

/**
 * Watches a wallet address for balance changes above a configurable threshold.
 * On first call, records the baseline and does not trigger.
 */
export class WalletWatcher {
  readonly watcherId: string;
  readonly address: string;
  readonly chainKey: string;
  private readonly client: RpcClient;
  private readonly thresholdPercent: number;
  private lastKnownBalance: bigint | null = null;

  constructor(
    watcherId: string,
    address: string,
    chainKey: string,
    client: RpcClient,
    thresholdPercent = 5
  ) {
    this.watcherId = watcherId;
    this.address = address;
    this.chainKey = chainKey;
    this.client = client;
    this.thresholdPercent = thresholdPercent;
  }

  async check(): Promise<WatcherResult> {
    const raw = await this.client.getBalance(this.address, this.chainKey);
    const current = BigInt(raw);

    if (this.lastKnownBalance === null) {
      this.lastKnownBalance = current;
      return { triggered: false };
    }

    const previous = this.lastKnownBalance;
    if (previous === current) return { triggered: false };

    const changed = previous === 0n
      ? current > 0n
      : (current > previous ? current - previous : previous - current) * 100n / previous >= BigInt(this.thresholdPercent);

    if (!changed) return { triggered: false };

    this.lastKnownBalance = current;
    const direction = current > previous ? "increased" : "decreased";

    return {
      triggered: true,
      alert: {
        type: "wallet_state_change",
        watcherId: this.watcherId,
        chainKey: this.chainKey,
        address: this.address,
        message: `Balance ${direction} from ${previous} to ${current} wei on ${this.chainKey}`,
        severity: "info",
        data: {
          previousBalance: previous.toString(),
          currentBalance: current.toString(),
          direction
        }
      }
    };
  }

  /** Reset baseline (e.g. after handling an alert). */
  resetBaseline(): void {
    this.lastKnownBalance = null;
  }
}

/**
 * Watches a contract address for emitted events by polling getLogs.
 * Advances the fromBlock cursor so each check only looks at new blocks.
 */
export class ContractEventWatcher {
  readonly watcherId: string;
  readonly address: string;
  readonly chainKey: string;
  private readonly client: RpcClient;
  private fromBlock: bigint;

  constructor(
    watcherId: string,
    address: string,
    chainKey: string,
    client: RpcClient,
    fromBlock = 0n
  ) {
    this.watcherId = watcherId;
    this.address = address;
    this.chainKey = chainKey;
    this.client = client;
    this.fromBlock = fromBlock;
  }

  async check(): Promise<WatcherResult> {
    const logs = await this.client.getLogs(this.address, this.chainKey, this.fromBlock);

    if (logs.length === 0) return { triggered: false };

    // Advance cursor past the last seen block
    const lastBlock = logs.reduce((max, l) => (l.blockNumber > max ? l.blockNumber : max), logs[0].blockNumber);
    this.fromBlock = lastBlock + 1n;

    return {
      triggered: true,
      alert: {
        type: "contract_event",
        watcherId: this.watcherId,
        chainKey: this.chainKey,
        address: this.address,
        message: `${logs.length} event(s) detected on ${this.address} at block(s) up to ${lastBlock}`,
        severity: "info",
        data: {
          eventCount: logs.length,
          logs: logs.map((l) => ({
            blockNumber: l.blockNumber.toString(),
            transactionHash: l.transactionHash,
            topics: l.topics
          }))
        }
      }
    };
  }

  get currentFromBlock(): bigint {
    return this.fromBlock;
  }
}

/**
 * Registry of active watchers keyed by watcherId.
 */
export class WatcherRegistry {
  private watchers: Map<string, WalletWatcher | ContractEventWatcher> = new Map();

  register(watcher: WalletWatcher | ContractEventWatcher): void {
    this.watchers.set(watcher.watcherId, watcher);
  }

  get(watcherId: string): WalletWatcher | ContractEventWatcher | undefined {
    return this.watchers.get(watcherId);
  }

  remove(watcherId: string): void {
    this.watchers.delete(watcherId);
  }

  list(): (WalletWatcher | ContractEventWatcher)[] {
    return Array.from(this.watchers.values());
  }

  async checkAll(): Promise<Array<{ watcherId: string; result: WatcherResult }>> {
    const results: Array<{ watcherId: string; result: WatcherResult }> = [];
    for (const watcher of this.watchers.values()) {
      const result = await watcher.check();
      results.push({ watcherId: watcher.watcherId, result });
    }
    return results;
  }
}
