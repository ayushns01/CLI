import type { TraceReport } from "../../../../packages/debug/src/trace.ts";

export function renderTraceReport(report: TraceReport): string {
  return [
    `chain: ${report.chainKey}`,
    `transaction: ${report.txHash}`,
    "calls:",
    ...report.callStack.map(renderFrame)
  ].join("\n");
}

function renderFrame(frame: TraceReport["callStack"][number]): string {
  const error = frame.error ? ` ERROR: ${frame.error}` : "";
  const target = frame.to ? ` to=${frame.to}` : "";
  const gas = frame.gasUsed === undefined ? "" : ` gas=${frame.gasUsed.toString()}`;
  return `${frame.depth} ${frame.type} ${frame.decodedCall}${error}${target}${gas}`;
}
