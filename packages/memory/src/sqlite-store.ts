import { DatabaseSync } from "node:sqlite";

import type {
  ContractMemoryRecord,
  EnvironmentProfile,
  RunHistoryRecord,
  WalletMemoryRecord,
  WorkspacePreferences
} from "./models.ts";

export class SqliteWorkspaceStore {
  private readonly db: DatabaseSync;

  constructor(databasePath = ":memory:") {
    this.db = new DatabaseSync(databasePath);
    this.migrate();
  }

  saveWallet(record: WalletMemoryRecord): void {
    this.db
      .prepare(
        `insert into wallets (label, address, signer_type)
         values (?, ?, ?)
         on conflict(label) do update set address = excluded.address, signer_type = excluded.signer_type`
      )
      .run(record.label, record.address, record.signerType);
  }

  getWallet(label: string): WalletMemoryRecord | undefined {
    const row = this.db.prepare("select label, address, signer_type from wallets where label = ?").get(label) as WalletRow | undefined;
    return row ? mapWallet(row) : undefined;
  }

  listWallets(): WalletMemoryRecord[] {
    return (this.db.prepare("select label, address, signer_type from wallets order by label").all() as WalletRow[]).map(mapWallet);
  }

  saveContract(record: ContractMemoryRecord): void {
    this.db
      .prepare(
        `insert into contracts (name, chain_key, address, transaction_hash, block_number, artifact_path)
         values (?, ?, ?, ?, ?, ?)
         on conflict(name, chain_key) do update set
           address = excluded.address,
           transaction_hash = excluded.transaction_hash,
           block_number = excluded.block_number,
           artifact_path = excluded.artifact_path`
      )
      .run(
        record.name,
        record.chainKey,
        record.address,
        record.transactionHash ?? null,
        record.blockNumber?.toString() ?? null,
        record.artifactPath ?? null
      );
  }

  getContract(name: string, chainKey: string): ContractMemoryRecord | undefined {
    const row = this.db
      .prepare("select name, chain_key, address, transaction_hash, block_number, artifact_path from contracts where name = ? and chain_key = ?")
      .get(name, chainKey) as ContractRow | undefined;
    return row ? mapContract(row) : undefined;
  }

  listContracts(chainKey?: string): ContractMemoryRecord[] {
    const statement = chainKey
      ? this.db.prepare("select name, chain_key, address, transaction_hash, block_number, artifact_path from contracts where chain_key = ? order by name")
      : this.db.prepare("select name, chain_key, address, transaction_hash, block_number, artifact_path from contracts order by chain_key, name");
    const rows = (chainKey ? statement.all(chainKey) : statement.all()) as ContractRow[];
    return rows.map(mapContract);
  }

  recordRun(record: RunHistoryRecord): void {
    this.db
      .prepare(
        `insert into runs (id, command, status, chain_key, summary, started_at, finished_at)
         values (?, ?, ?, ?, ?, ?, ?)
         on conflict(id) do update set
           command = excluded.command,
           status = excluded.status,
           chain_key = excluded.chain_key,
           summary = excluded.summary,
           started_at = excluded.started_at,
           finished_at = excluded.finished_at`
      )
      .run(
        record.id,
        record.command,
        record.status,
        record.chainKey ?? null,
        record.summary ?? null,
        record.startedAt,
        record.finishedAt ?? null
      );
  }

  listRuns(limit = 50): RunHistoryRecord[] {
    return (this.db
      .prepare("select id, command, status, chain_key, summary, started_at, finished_at from runs order by started_at desc limit ?")
      .all(limit) as RunRow[]).map(mapRun);
  }

  savePreferences(preferences: WorkspacePreferences): void {
    this.db
      .prepare(
        `insert into preferences (id, default_wallet, default_chain, preferred_chains_json)
         values (1, ?, ?, ?)
         on conflict(id) do update set
           default_wallet = excluded.default_wallet,
           default_chain = excluded.default_chain,
           preferred_chains_json = excluded.preferred_chains_json`
      )
      .run(preferences.defaultWallet ?? null, preferences.defaultChain ?? null, JSON.stringify(preferences.preferredChains));
  }

  getPreferences(): WorkspacePreferences {
    const row = this.db
      .prepare("select default_wallet, default_chain, preferred_chains_json from preferences where id = 1")
      .get() as PreferencesRow | undefined;

    return {
      defaultWallet: row?.default_wallet,
      defaultChain: row?.default_chain,
      preferredChains: row ? JSON.parse(row.preferred_chains_json) as string[] : []
    };
  }

  saveEnvironment(profile: EnvironmentProfile): void {
    this.db
      .prepare(
        `insert into environments (name, default_chain, rpc_overrides_json)
         values (?, ?, ?)
         on conflict(name) do update set
           default_chain = excluded.default_chain,
           rpc_overrides_json = excluded.rpc_overrides_json`
      )
      .run(profile.name, profile.defaultChain ?? null, JSON.stringify(profile.rpcOverrides));
  }

  getEnvironment(name: string): EnvironmentProfile | undefined {
    const row = this.db
      .prepare("select name, default_chain, rpc_overrides_json from environments where name = ?")
      .get(name) as EnvironmentRow | undefined;
    return row ? mapEnvironment(row) : undefined;
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      create table if not exists wallets (
        label text primary key,
        address text not null,
        signer_type text not null
      );

      create table if not exists contracts (
        name text not null,
        chain_key text not null,
        address text not null,
        transaction_hash text,
        block_number text,
        artifact_path text,
        primary key (name, chain_key)
      );

      create table if not exists runs (
        id text primary key,
        command text not null,
        status text not null,
        chain_key text,
        summary text,
        started_at text not null,
        finished_at text
      );

      create table if not exists preferences (
        id integer primary key check (id = 1),
        default_wallet text,
        default_chain text,
        preferred_chains_json text not null
      );

      create table if not exists environments (
        name text primary key,
        default_chain text,
        rpc_overrides_json text not null
      );
    `);
  }
}

interface WalletRow {
  label: string;
  address: string;
  signer_type: string;
}

interface ContractRow {
  name: string;
  chain_key: string;
  address: string;
  transaction_hash: string | null;
  block_number: string | null;
  artifact_path: string | null;
}

interface RunRow {
  id: string;
  command: string;
  status: RunHistoryRecord["status"];
  chain_key: string | null;
  summary: string | null;
  started_at: string;
  finished_at: string | null;
}

interface PreferencesRow {
  default_wallet: string | null;
  default_chain: string | null;
  preferred_chains_json: string;
}

interface EnvironmentRow {
  name: string;
  default_chain: string | null;
  rpc_overrides_json: string;
}

function mapWallet(row: WalletRow): WalletMemoryRecord {
  return {
    label: row.label,
    address: row.address,
    signerType: row.signer_type
  };
}

function mapContract(row: ContractRow): ContractMemoryRecord {
  return {
    name: row.name,
    chainKey: row.chain_key,
    address: row.address,
    transactionHash: row.transaction_hash ?? undefined,
    blockNumber: row.block_number === null ? undefined : BigInt(row.block_number),
    artifactPath: row.artifact_path ?? undefined
  };
}

function mapRun(row: RunRow): RunHistoryRecord {
  return {
    id: row.id,
    command: row.command,
    status: row.status,
    chainKey: row.chain_key ?? undefined,
    summary: row.summary ?? undefined,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined
  };
}

function mapEnvironment(row: EnvironmentRow): EnvironmentProfile {
  return {
    name: row.name,
    defaultChain: row.default_chain ?? undefined,
    rpcOverrides: JSON.parse(row.rpc_overrides_json) as Record<string, string[]>
  };
}
