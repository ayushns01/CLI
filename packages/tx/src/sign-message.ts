import type { Signer } from "../../wallet/src/signer.ts";

export interface SignMessageResult {
  address: string;
  signature: string;
}

export async function signMessageWithSigner(signer: Signer, message: string): Promise<SignMessageResult> {
  return {
    address: signer.address,
    signature: await signer.signMessage(message)
  };
}
