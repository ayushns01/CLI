export type SessionPermission = "read" | "simulate" | "sign" | "broadcast";

export interface SessionScopeInput {
  walletLabel: string;
  chains: string[];
  permissions: SessionPermission[];
}

export interface SessionScope {
  walletLabel: string;
  chains: ReadonlySet<string>;
  permissions: ReadonlySet<SessionPermission>;
}

export interface SessionAction {
  chain: string;
  permission: SessionPermission;
}

export function createSessionScope(input: SessionScopeInput): SessionScope {
  return {
    walletLabel: input.walletLabel,
    chains: new Set(input.chains.map(normalizeChainKey)),
    permissions: new Set(input.permissions)
  };
}

export function assertSessionAllows(scope: SessionScope, action: SessionAction): void {
  if (!scope.chains.has(normalizeChainKey(action.chain))) {
    throw new Error(`Chain not allowed by session scope: ${action.chain}`);
  }

  if (!scope.permissions.has(action.permission)) {
    throw new Error(`Permission not allowed by session scope: ${action.permission}`);
  }
}

function normalizeChainKey(chain: string): string {
  return chain.trim().toLowerCase().replace(/[\s_]+/g, "-");
}
