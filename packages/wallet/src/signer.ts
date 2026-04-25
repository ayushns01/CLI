export type SignerType = "local-keychain" | "hardware" | "safe";

export interface Signer {
  type: SignerType;
  address: string;
  signMessage(message: string): Promise<string>;
}
