import { DatabaseSync } from "node:sqlite";

import type {
  AddressEntry,
  AlertRecord,
  AuditRecord,
  ContractMemoryRecord,
  EnvironmentProfile,
  RunHistoryRecord,
  AddressEntry,
  WalletMemoryRecord,
  WorkspacePreferences
} from "./models.ts";

export interface AuditFilter {
  actorId?: string;
  env?: string;
  allowed?: boolean;
  action?: string;
  since?: string;   // ISO-8601, inclusive lower bound
}

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

  saveAlert(record: AlertRecord): void {
    this.db
      .prepare(
        `insert into alerts (id, type, watcher_id, chain_key, address, message, severity, data_json, triggered_at, resolved_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict(id) do update set
           resolved_at = excluded.resolved_at`
      )
      .run(
        record.id,
        record.type,
        record.watcherId,
        record.chainKey ?? null,
        record.address ?? null,
        record.message,
        record.severity,
        record.dataJson,
        record.triggeredAt,
        record.resolvedAt ?? null
      );
  }

  getAlert(id: string): AlertRecord | undefined {
    const row = this.db
      .prepare("select id, type, watcher_id, chain_key, address, message, severity, data_json, triggered_at, resolved_at from alerts where id = ?")
      .get(id) as AlertRow | undefined;
    return row ? mapAlert(row) : undefined;
  }

  listAlerts(filter?: { watcherId?: string; resolved?: boolean }): AlertRecord[] {
    let sql = "select id, type, watcher_id, chain_key, address, message, severity, data_json, triggered_at, resolved_at from alerts";
    const conditions: string[] = [];
    const params: (string | null)[] = [];

    if (filter?.watcherId !== undefined) {
      conditions.push("watcher_id = ?");
      params.push(filter.watcherId);
    }
    if (filter?.resolved === true) {
      conditions.push("resolved_at is not null");
    } else if (filter?.resolved === false) {
      conditions.push("resolved_at is null");
    }

    if (conditions.length > 0) {
      sql += " where " + conditions.join(" and ");
    }
    sql += " order by triggered_at desc";

    const stmt = this.db.prepare(sql);
    const rows = (params.length > 0 ? stmt.all(...params) : stmt.all()) as AlertRow[];
    return rows.map(mapAlert);
  }

  resolveAlert(id: string): void {
    this.db
      .prepare("update alerts set resolved_at = ? where id = ?")
      .run(new Date().toISOString(), id);
  }

  saveAuditRecord(record: AuditRecord): void {
    this.db
      .prepare(
        `insert or ignore into audit (id, timestamp, actor_id, action, env, allowed, reason, metadata)
         values (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.id,
        record.timestamp,
        record.actorId,
        record.action,
        record.env,
        record.allowed ? 1 : 0,
        record.reason ?? null,
        record.metadata ?? null
      );
  }

  listAuditRecords(filter?: AuditFilter): AuditRecord[] {
    let sql = "select id, timestamp, actor_id, action, env, allowed, reason, metadata from audit";
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];

    if (filter?.actorId !== undefined) {
      conditions.push("actor_id = ?");
      params.push(filter.actorId);
    }
    if (filter?.env !== undefined) {
      conditions.push("env = ?");
      params.push(filter.env);
    }
    if (filter?.allowed !== undefined) {
      conditions.push("allowed = ?");
      params.push(filter.allowed ? 1 : 0);
    }
    if (filter?.action !== undefined) {
      conditions.push("action = ?");
      params.push(filter.action);
    }
    if (filter?.since !== undefined) {
      conditions.push("timestamp >= ?");
      params.push(filter.since);
    }

    if (conditions.length > 0) {
      sql += " where " + conditions.join(" and ");
    }
    sql += " order by timestamp desc";

    const stmt = this.db.prepare(sql);
    const rows = (params.length > 0 ? stmt.all(...params) : stmt.all()) as AuditRow[];
    return rows.map(mapAudit);
  }

  close(): void {
    this.db.close();
  }

  saveAddress(entry: AddressEntry): void {
    this.db
      .prepare(
        `insert into addresses (name, address, chain_key, created_at)
         values (?, ?, ?, ?)
         on conflict(name) do update set
           address = excluded.address,
           chain_key = excluded.chain_key`
      )
      .run(
        entry.name,
        entry.address,
        entry.chainKey ?? null,
        entry.createdAt
      );
  }

  getAddress(name: string): AddressEntry | undefined {
    const row = this.db
      .prepare("select name, address, chain_key, created_at from addresses where name = ?")
      .get(name) as AddressRow | undefined;
    return row ? mapAddress(row) : undefined;
  }

  listAddresses(): AddressEntry[] {
    return (this.db
      .prepare("select name, address, chain_key, created_at from addresses order by name")
      .all() as AddressRow[]).map(mapAddress);
  }

  removeAddress(name: string): boolean {
    const info = this.db.prepare("delete from addresses where name = ?").run(name);
    return info.changes > 0;
  }

  resolveAddress(nameOrAddress: string): string {
    if (nameOrAddress.startsWith("0x") || nameOrAddress.endsWith(".eth")) {
      return nameOrAddress;
    }
    const entry = this.getAddress(nameOrAddress);
    if (!entry) {
      throw new Error(`Address not found: ${nameOrAddress}`);
    }
    return entry.address;
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

      create table if not exists addresses (
        name text primary key,
        address text not null,
        chain_key text,
        created_at text not null
      );


      create table if not exists addresses (
        name text primary key,
        address text not null,
        chain_key text,
        created_at text not null
      );

      create table if not exists alerts (
        id text primary key,
        type text not null,
        watcher_id text not null,
        chain_key text,
        address text,
        message text not null,
        severity text not null,
        data_json text not null,
        triggered_at text not null,
        resolved_at text
      );

      create table if not exists audit (
        id text primary key,
        timestamp text not null,
        actor_id text not null,
        action text not null,
        env text not null,
        allowed integer not null,
        reason text,
        metadata text
      );
    `);
  }
}

interface AddressRow {
  name: string;
  address: string;
  chain_key: string | null;
  created_at: string;
}

function mapAddress(row: AddressRow): AddressEntry {
  return {
    name: row.name,
    address: row.address,
    chainKey: row.chain_key ?? undefined,
    createdAt: row.created_at
  };
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

interface AddressRow {
  name: string;
  address: string;
  chain_key: string | null;
  created_at: string;
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

interface AlertRow {
  id: string;
  type: string;
  watcher_id: string;
  chain_key: string | null;
  address: string | null;
  message: string;
  severity: string;
  data_json: string;
  triggered_at: string;
  resolved_at: string | null;
}

function mapAlert(row: AlertRow): AlertRecord {
  return {
    id: row.id,
    type: row.type as AlertRecord["type"],
    watcherId: row.watcher_id,
    chainKey: row.chain_key ?? undefined,
    address: row.address ?? undefined,
    message: row.message,
    severity: row.severity as AlertRecord["severity"],
    dataJson: row.data_json,
    triggeredAt: row.triggered_at,
    resolvedAt: row.resolved_at ?? undefined
  };
}

interface AuditRow {
  id: string;
  timestamp: string;
  actor_id: string;
  action: string;
  env: string;
  allowed: number;   // 1 or 0
  reason: string | null;
  metadata: string | null;
}

function mapAudit(row: AuditRow): AuditRecord {
  return {
    id: row.id,
    timestamp: row.timestamp,
    actorId: row.actor_id,
    action: row.action,
    env: row.env,
    allowed: row.allowed === 1,
    reason: row.reason ?? undefined,
    metadata: row.metadata ?? undefined
  };
}
