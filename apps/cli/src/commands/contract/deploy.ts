import type { ContractDeploymentPlan, DeploymentRecord } from "../../../../../../packages/contracts/src/deployer.ts";

export function renderContractDeployPlan(plan: ContractDeploymentPlan): string {
  return [
    `contract: ${plan.contractName}`,
    `chain: ${plan.chainKey}`,
    `from: ${plan.from}`,
    `deployData: ${plan.deployData}`,
    `constructorWords: ${plan.constructorWords.length}`
  ].join("\n");
}

export function renderDeploymentRecord(record: DeploymentRecord): string {
  return [
    `contract: ${record.contractName}`,
    `chain: ${record.chainKey}`,
    `address: ${record.address}`,
    `transaction: ${record.transactionHash}`,
    `block: ${record.blockNumber.toString()}`
  ].join("\n");
}
