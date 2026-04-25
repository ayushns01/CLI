import type { Erc20DeployIntent } from "../../../../../packages/contracts/src/deployer.ts";

export function renderTokenDeployIntent(intent: Erc20DeployIntent): string {
  return [
    `contract: ${intent.contractName}`,
    `name: ${intent.name}`,
    `symbol: ${intent.symbol}`,
    `decimals: ${intent.decimals}`,
    `initialSupply: ${intent.initialSupply}`,
    `chain: ${intent.chainKey}`
  ].join("\n");
}
