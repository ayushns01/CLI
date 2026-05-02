import { createInterface, type Interface } from "node:readline/promises";
import { env, stdin, stdout } from "node:process";

import type { CliResult } from "./router.ts";

export interface InteractiveChoice {
  label: string;
  value: string;
}

export interface InteractivePrompt {
  select(prompt: string, choices: InteractiveChoice[]): Promise<string>;
  input(prompt: string, options?: { defaultValue?: string; secret?: boolean }): Promise<string>;
}

export interface InteractiveSessionOptions {
  prompt: InteractivePrompt;
  write(line: string): void;
  runCommand(args: string[]): Promise<CliResult>;
  chainKeys: string[];
}

const featureChoices: InteractiveChoice[] = [
  { label: "Check balance              - Read native balance for one address", value: "balance" },
  { label: "Check all testnet balances - Scan configured testnets", value: "allbal" },
  { label: "Estimate gas               - Preview transaction cost", value: "gas" },
  { label: "Simulate transaction       - Dry-run before signing", value: "simulate" },
  { label: "Trace transaction          - Explain a transaction path", value: "trace" },
  { label: "Deploy contract            - Broadcast bytecode after confirmation", value: "deploy" },
  { label: "Exit                       - Close the workstation", value: "exit" }
];

export async function runInteractiveSession(options: InteractiveSessionOptions): Promise<void> {
  renderIntro().forEach(options.write);

  while (true) {
    const feature = await options.prompt.select("Feature", featureChoices);
    if (feature === "exit") {
      options.write(formatStatus("Session closed. No pending actions.", "muted"));
      return;
    }

    const args = await buildCommandArgs(feature, options);
    if (!args) {
      continue;
    }

    const result = await options.runCommand(args);
    if (result.stdout) {
      options.write(renderSection("Command output", result.stdout));
    }
    if (result.stderr) {
      options.write(renderSection("Command error", result.stderr));
    }
  }
}

export function createTerminalPrompt(): { prompt: InteractivePrompt; close(): void } {
  const readline = createInterface({ input: stdin, output: stdout });
  return {
    prompt: new TerminalPrompt(readline),
    close: () => readline.close()
  };
}

async function buildCommandArgs(
  feature: string,
  options: InteractiveSessionOptions
): Promise<string[] | undefined> {
  if (feature === "balance") {
    const chain = await selectChain(options);
    const address = await options.prompt.input("Address");
    return ["balance", "--chain", chain, "--address", address];
  }

  if (feature === "allbal") {
    const address = await options.prompt.input("Address");
    return ["allbal", "--testnet", "--address", address];
  }

  if (feature === "gas") {
    const txInput = await collectTransactionInput(options);
    return [
      "gas",
      "estimate",
      "--chain",
      txInput.chain,
      "--from",
      txInput.from,
      "--to",
      txInput.to,
      "--data",
      txInput.data,
      "--value-wei",
      txInput.valueWei
    ];
  }

  if (feature === "simulate") {
    const txInput = await collectTransactionInput(options);
    return [
      "simulate",
      "--chain",
      txInput.chain,
      "--from",
      txInput.from,
      "--to",
      txInput.to,
      "--data",
      txInput.data,
      "--value-wei",
      txInput.valueWei
    ];
  }

  if (feature === "trace") {
    const chain = await selectChain(options);
    const txHash = await options.prompt.input("Transaction hash");
    return ["trace", "--chain", chain, "--tx", txHash];
  }

  if (feature === "deploy") {
    const chain = await selectChain(options);
    const bytecode = await options.prompt.input("Bytecode");
    const privateKey = await options.prompt.input("Private key", { secret: true });
    const confirm = await options.prompt.select("Broadcast real transaction?", [
      { label: "No, cancel", value: "no" },
      { label: "Yes, broadcast", value: "yes" }
    ]);

    if (confirm !== "yes") {
      options.write(formatStatus("Deploy cancelled. No transaction was broadcast.", "warning"));
      return undefined;
    }

    return [
      "deploy",
      "--chain",
      chain,
      "--bytecode",
      bytecode,
      "--private-key",
      privateKey,
      "--confirm-broadcast"
    ];
  }

  options.write(`Unknown feature: ${feature}`);
  return undefined;
}

async function collectTransactionInput(options: InteractiveSessionOptions): Promise<{
  chain: string;
  from: string;
  to: string;
  data: string;
  valueWei: string;
}> {
  return {
    chain: await selectChain(options),
    from: await options.prompt.input("From address"),
    to: await options.prompt.input("To address"),
    data: await options.prompt.input("Calldata", { defaultValue: "0x" }),
    valueWei: await options.prompt.input("Value wei", { defaultValue: "0" })
  };
}

async function selectChain(options: InteractiveSessionOptions): Promise<string> {
  return options.prompt.select(
    "Chain",
    options.chainKeys.map((chainKey) => ({ label: chainKey, value: chainKey }))
  );
}

class TerminalPrompt implements InteractivePrompt {
  private readonly readline: Interface;

  constructor(readline: Interface) {
    this.readline = readline;
  }

  async select(prompt: string, choices: InteractiveChoice[]): Promise<string> {
    while (true) {
      stdout.write(color(`\n${prompt}\n`, "cyan"));
      choices.forEach((choice, index) => {
        stdout.write(`  ${color(String(index + 1).padStart(2, " "), "bold")}. ${choice.label}\n`);
      });

      const answer = await this.readline.question(color("> Select number: ", "green"));
      const selectedIndex = Number.parseInt(answer.trim(), 10) - 1;
      const selected = choices[selectedIndex];
      if (selected) {
        return selected.value;
      }

      stdout.write(formatStatus("Invalid selection. Choose one of the listed numbers.", "warning"));
      stdout.write("\n");
    }
  }

  async input(prompt: string, options?: { defaultValue?: string; secret?: boolean }): Promise<string> {
    const suffix = options?.defaultValue ? ` (${options.defaultValue})` : "";
    const answer = await this.readline.question(color(`> ${prompt}${suffix}: `, "green"));
    const value = answer.trim();
    if (!value && options?.defaultValue !== undefined) {
      return options.defaultValue;
    }
    return value;
  }
}

function renderIntro(): string[] {
  return [
    color("+------------------------------------------------------------+", "cyan"),
    color("| ChainMind                                                  |", "bold"),
    color("| AI EVM Developer Workstation                              |", "bold"),
    color("| Select a feature. Broadcast actions require confirmation. |", "muted"),
    color("+------------------------------------------------------------+", "cyan")
  ];
}

function renderSection(title: string, body: string): string {
  const lines = body.trimEnd().split("\n");
  return [
    "",
    color(`-- ${title} --`, title === "Command error" ? "warning" : "cyan"),
    ...lines.map((line) => `  ${line}`)
  ].join("\n");
}

function formatStatus(message: string, tone: "muted" | "warning"): string {
  const marker = tone === "warning" ? "!" : "-";
  return color(`${marker} ${message}`, tone);
}

function color(text: string, tone: "bold" | "cyan" | "green" | "muted" | "warning"): string {
  if (env.NO_COLOR) {
    return text;
  }

  const codes: Record<typeof tone, [number, number]> = {
    bold: [1, 22],
    cyan: [36, 39],
    green: [32, 39],
    muted: [2, 22],
    warning: [33, 39]
  };
  const [open, close] = codes[tone];
  return `\u001B[${open}m${text}\u001B[${close}m`;
}
