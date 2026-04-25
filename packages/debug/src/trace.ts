export interface TraceCall {
  type: string;
  from: string;
  to?: string;
  input: string;
  selector?: string;
  valueWei?: bigint;
  gasUsed?: bigint;
  error?: string;
  revertData?: string;
  calls?: TraceCall[];
}

export interface TransactionTrace {
  chainKey: string;
  txHash: string;
  root: TraceCall;
}

export interface TraceClient {
  getTrace(txHash: string): Promise<{
    txHash?: string;
    root: TraceCall;
  }>;
}

export interface FetchTransactionTraceInput {
  chainKey: string;
  txHash: string;
  client: TraceClient;
}

export interface TraceCallFrame {
  depth: number;
  type: string;
  from: string;
  to?: string;
  input: string;
  decodedCall: string;
  valueWei?: bigint;
  gasUsed?: bigint;
  error?: string;
  revertData?: string;
}

export interface TraceReport {
  chainKey: string;
  txHash: string;
  callStack: TraceCallFrame[];
}

export async function fetchTransactionTrace(input: FetchTransactionTraceInput): Promise<TransactionTrace> {
  const trace = await input.client.getTrace(input.txHash);

  return {
    chainKey: input.chainKey,
    txHash: trace.txHash ?? input.txHash,
    root: trace.root
  };
}

export function buildTraceReport(trace: TransactionTrace): TraceReport {
  return {
    chainKey: trace.chainKey,
    txHash: trace.txHash,
    callStack: flattenCall(trace.root, 0)
  };
}

function flattenCall(call: TraceCall, depth: number): TraceCallFrame[] {
  const frame: TraceCallFrame = {
    depth,
    type: call.type,
    from: call.from,
    to: call.to,
    input: call.input,
    decodedCall: call.selector ?? decodeSelector(call.input),
    valueWei: call.valueWei,
    gasUsed: call.gasUsed,
    error: call.error,
    revertData: call.revertData
  };

  return [
    frame,
    ...(call.calls ?? []).flatMap((child) => flattenCall(child, depth + 1))
  ];
}

function decodeSelector(input: string): string {
  const normalized = input.startsWith("0x") ? input.toLowerCase() : `0x${input.toLowerCase()}`;
  if (!/^0x[0-9a-f]*$/.test(normalized) || normalized.length < 10) {
    return "unknown";
  }
  return normalized.slice(0, 10);
}
