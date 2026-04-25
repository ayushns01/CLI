import type { TransactionPreview, TransactionRequest } from "./preview.ts";

export interface SimulationSuccess {
  success: true;
  gasUsed: bigint;
  stateChanges: string[];
}

export interface SimulationFailure {
  success: false;
  revertData?: string;
}

export type RawSimulationResult = SimulationSuccess | SimulationFailure;

export interface SimulatedTransactionSuccess extends SimulationSuccess {
  revertReason?: undefined;
}

export interface SimulatedTransactionFailure extends SimulationFailure {
  revertReason: string;
  gasUsed?: undefined;
  stateChanges?: undefined;
}

export type SimulatedTransactionResult = SimulatedTransactionSuccess | SimulatedTransactionFailure;

export interface SimulationClient {
  simulate(request: TransactionRequest): Promise<RawSimulationResult>;
}

export interface SimulateTransactionInput {
  request: TransactionRequest;
  client: SimulationClient;
}

const STANDARD_ERROR_SELECTOR = "08c379a0";

export async function simulateTransaction(input: SimulateTransactionInput): Promise<SimulatedTransactionResult> {
  const result = await input.client.simulate(input.request);
  if (result.success) {
    return result;
  }

  return {
    success: false,
    revertData: result.revertData,
    revertReason: decodeRevertReason(result.revertData)
  };
}

export function assertSimulationMatchesPreview(preview: TransactionPreview, request: TransactionRequest): void {
  if (
    preview.chainKey !== request.chainKey ||
    preview.from.toLowerCase() !== request.from.toLowerCase() ||
    preview.to.toLowerCase() !== request.to.toLowerCase() ||
    preview.data.toLowerCase() !== request.data.toLowerCase() ||
    preview.valueWei !== request.valueWei
  ) {
    throw new Error("Simulation request does not match preview");
  }
}

export function decodeRevertReason(revertData?: string): string {
  if (!revertData) {
    return "Transaction reverted without reason";
  }

  const data = revertData.startsWith("0x") ? revertData.slice(2) : revertData;
  if (!data.startsWith(STANDARD_ERROR_SELECTOR) || data.length < 8 + 64 + 64) {
    return `Raw revert data: 0x${data}`;
  }

  const lengthWordStart = 8 + 64;
  const length = Number.parseInt(data.slice(lengthWordStart, lengthWordStart + 64), 16);
  const stringStart = lengthWordStart + 64;
  const encodedReason = data.slice(stringStart, stringStart + length * 2);
  return hexToUtf8(encodedReason);
}

function hexToUtf8(hex: string): string {
  const bytes: number[] = [];
  for (let index = 0; index < hex.length; index += 2) {
    bytes.push(Number.parseInt(hex.slice(index, index + 2), 16));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}
