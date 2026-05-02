const commandGroups = [
  "wallet",
  "chain",
  "contract",
  "tx",
  "debug",
  "agent",
  "monitor"
];

const wiredCommands = [
  "balance --chain <chain> --address <address>",
  "allbal --testnet --address <address>",
  "gas estimate --chain <chain> --from <address> --to <address> [--data 0x] [--value-wei 0]",
  "simulate --chain <chain> --from <address> --to <address> [--data 0x] [--value-wei 0]",
  "trace --chain <chain> --tx <txHash>",
  "deploy --chain <chain> --bytecode <hex> --private-key <hex> --confirm-broadcast"
];

export function renderRootHelp(): string {
  return [
    "ChainMind CLI",
    "",
    "Available command groups:",
    ...commandGroups.map((group) => `- ${group}`),
    "",
    "Wired commands:",
    ...wiredCommands.map((command) => `- ${command}`),
    "",
    "Workspace config:",
    "- Reads .chainmind.yaml or chainmind.config.json from the current project",
    "- Supports rpcOverrides, chainAliases, and CHAINMIND_ENV environment profiles"
  ].join("\n");
}
