import { decodeRevertReason } from "../../tx/src/simulate.ts";
import { buildTraceReport, type TraceCallFrame, type TransactionTrace } from "./trace.ts";

export interface RevertExplainerInput {
  chainKey: string;
  txHash: string;
  revertReason: string;
  failedCall?: TraceCallFrame;
  callStack: TraceCallFrame[];
  promptFacts: string[];
}

export function buildRevertExplainerInput(trace: TransactionTrace): RevertExplainerInput {
  const report = buildTraceReport(trace);
  const failedCall = findFailedCall(report.callStack);
  const revertReason = failedCall?.error ?? decodeRevertReason(failedCall?.revertData);

  return {
    chainKey: trace.chainKey,
    txHash: trace.txHash,
    revertReason,
    failedCall,
    callStack: report.callStack,
    promptFacts: [
      `Chain: ${trace.chainKey}`,
      `Transaction: ${trace.txHash}`,
      `Revert reason: ${revertReason}`,
      `Failed call: ${failedCall ? `${failedCall.type} ${failedCall.decodedCall}` : "unknown"}`
    ]
  };
}

function findFailedCall(callStack: TraceCallFrame[]): TraceCallFrame | undefined {
  return [...callStack].reverse().find((entry) => entry.error || entry.revertData);
}
