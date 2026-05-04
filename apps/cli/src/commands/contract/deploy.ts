import type { ContractDeploymentPlan, DeploymentRecord } from "../../../../../packages/contracts/src/deployer.ts";

export interface MultiChainDeployRow {
  chainKey: string;
  address?: string;
  txHash?: string;
  error?: string;
  verifyStatus?: string;
}

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

export function renderMultiChainDeploySummary(contractName: string, rows: MultiChainDeployRow[]): string {
  const succeeded = rows.filter((r) => !r.error).length;
  const total = rows.length;

  const lines: string[] = [
    `Multi-chain deploy: ${contractName}`,
    "─".repeat(62)
  ];

  for (const row of rows) {
    if (row.error) {
      lines.push(`  ✗  ${padChainKey(row.chainKey)}  failed: ${row.error}`);
    } else {
      lines.push(`  ✓  ${padChainKey(row.chainKey)}  ${row.address}  tx: ${row.txHash}`);
      if (row.verifyStatus) {
        lines.push(`     ${" ".repeat(padChainKey(row.chainKey).length)}  ${row.verifyStatus}`);
      }
    }
  }

  lines.push("─".repeat(62));
  lines.push(`Deployed: ${succeeded}/${total} chains`);
  return lines.join("\n");
}

function padChainKey(key: string): string {
  return key.padEnd(16);
}
