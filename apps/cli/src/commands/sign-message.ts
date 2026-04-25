import type { SignMessageResult } from "../../../../packages/tx/src/sign-message.ts";

export function renderSignMessageResult(result: SignMessageResult): string {
  return [
    `address: ${result.address}`,
    `signature: ${result.signature}`
  ].join("\n");
}
