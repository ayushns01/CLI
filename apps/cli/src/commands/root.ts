const commandGroups = [
  "wallet",
  "chain",
  "contract",
  "tx",
  "debug",
  "agent",
  "monitor"
];

export function renderRootHelp(): string {
  return [
    "ChainMind CLI",
    "",
    "Available command groups:",
    ...commandGroups.map((group) => `- ${group}`)
  ].join("\n");
}
