import { formatUnits } from "../../../../packages/tx/src/format.ts";

export function renderSendResult(result: unknown): string {
  const output = result as {
    chainKey: string;
    from: string;
    to: string;
    ensName?: string;
    valueWei: string;
    symbol: string;
    decimals: number;
    transactionHash: string;
    blockNumber: string;
  };

  const toDisplay = output.ensName ? `${output.ensName} (${output.to})` : output.to;
  const formatted = formatUnits(BigInt(output.valueWei), output.decimals, output.symbol);

  return [
    `chain: ${output.chainKey}`,
    `from: ${output.from}`,
    `to: ${toDisplay}`,
    `amount: ${formatted}`,
    `transaction: ${output.transactionHash}`,
    `block: ${output.blockNumber}`
  ].join("\n");
}

export function renderTransferResult(result: unknown): string {
  const output = result as {
    chainKey: string;
    from: string;
    to: string;
    ensName?: string;
    tokenAddress: string;
    symbol: string;
    decimals: number;
    amount: string;
    amountWei: string;
    transactionHash: string;
    blockNumber: string;
  };

  const toDisplay = output.ensName ? `${output.ensName} (${output.to})` : output.to;
  const formatted = formatUnits(BigInt(output.amountWei), output.decimals, output.symbol);

  return [
    `chain: ${output.chainKey}`,
    `token: ${output.tokenAddress} (${output.symbol})`,
    `from: ${output.from}`,
    `to: ${toDisplay}`,
    `amount: ${formatted}`,
    `transaction: ${output.transactionHash}`,
    `block: ${output.blockNumber}`
  ].join("\n");
}
