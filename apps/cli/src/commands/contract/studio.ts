import type { ContractFunctionSummary } from "../../../../../packages/contracts/src/studio.ts";
import type { TransactionPreview } from "../../../../../packages/tx/src/preview.ts";
import type { SimulatedTransactionResult } from "../../../../../packages/tx/src/simulate.ts";

export interface ContractStudioView {
  contractName: string;
  address: string;
  functions: ContractFunctionSummary[];
}

export interface WritePreviewView {
  preview: TransactionPreview;
  simulation: SimulatedTransactionResult;
}

export function renderContractStudio(view: ContractStudioView): string {
  return [
    `contract: ${view.contractName}`,
    `address: ${view.address}`,
    "functions:",
    ...view.functions.map((entry) => `- ${formatFunction(entry)}`)
  ].join("\n");
}

export function renderWritePreview(view: WritePreviewView): string {
  const simulationLines = view.simulation.success
    ? [`simulation: success`, `gasUsed: ${view.simulation.gasUsed.toString()}`, ...view.simulation.stateChanges.map((change) => `stateChange: ${change}`)]
    : [`simulation: reverted`, `reason: ${view.simulation.revertReason}`];

  return [
    `chain: ${view.preview.chainKey}`,
    `description: ${view.preview.description ?? "contract write"}`,
    `from: ${view.preview.from}`,
    `to: ${view.preview.to}`,
    `data: ${view.preview.data}`,
    `valueWei: ${view.preview.valueWei.toString()}`,
    `gasLimit: ${view.preview.gasLimit.toString()}`,
    `risk: ${view.preview.riskLevel}`,
    `approvalRequired: ${view.preview.requiresApproval}`,
    ...simulationLines
  ].join("\n");
}

function formatFunction(entry: ContractFunctionSummary): string {
  const inputs = entry.inputs.map((input) => `${input.type}${input.name ? ` ${input.name}` : ""}`).join(", ");
  const outputs = entry.outputs.map((output) => `${output.type}${output.name ? ` ${output.name}` : ""}`).join(", ");
  const outputSuffix = outputs ? ` -> ${outputs}` : "";
  return `${entry.name}(${inputs})${outputSuffix} [${entry.kind}]`;
}
