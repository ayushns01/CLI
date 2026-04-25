import type { SignerType } from "./signer.ts";

export interface WalletRecord {
  label: string;
  address: string;
  signerType: SignerType;
}

export interface WalletStore {
  save(wallet: WalletRecord): void;
  getByLabel(label: string): WalletRecord;
  all(): WalletRecord[];
}

export function createWalletStore(initialWallets: WalletRecord[] = []): WalletStore {
  const wallets = new Map<string, WalletRecord>();

  for (const wallet of initialWallets) {
    wallets.set(normalizeLabel(wallet.label), wallet);
  }

  return {
    save(wallet: WalletRecord) {
      wallets.set(normalizeLabel(wallet.label), wallet);
    },
    getByLabel(label: string) {
      const wallet = wallets.get(normalizeLabel(label));
      if (!wallet) {
        throw new Error(`Unknown wallet label: ${label}`);
      }
      return wallet;
    },
    all() {
      return [...wallets.values()];
    }
  };
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}
