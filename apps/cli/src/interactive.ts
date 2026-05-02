import { createInterface, type Interface } from "node:readline/promises";
import { env, exit, stdin, stdout } from "node:process";

import type { CliResult } from "./router.ts";
import { readArtifactFile } from "./artifact-reader.ts";

export interface InteractiveChoice {
  label: string;
  value: string;
}

export interface InteractivePrompt {
  select(prompt: string, choices: InteractiveChoice[]): Promise<string>;
  input(prompt: string, options?: InteractiveInputOptions): Promise<string>;
}

export interface InteractiveInputOptions {
  defaultValue?: string;
  secret?: boolean;
  validate?: (value: string) => string | undefined;
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
    const feature = await options.prompt.select("Select a feature", featureChoices);
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
    prompt: new TerminalPrompt(readline, {
      input: stdin,
      write: (text) => stdout.write(text)
    }),
    close: () => readline.close()
  };
}

async function buildCommandArgs(
  feature: string,
  options: InteractiveSessionOptions
): Promise<string[] | undefined> {
  if (feature === "balance") {
    const chain = await selectChain(options);
    const address = await options.prompt.input("Address", { validate: validateAddress });
    return ["balance", "--chain", chain, "--address", address];
  }

  if (feature === "allbal") {
    const address = await options.prompt.input("Address", { validate: validateAddress });
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
    const txHash = await options.prompt.input("Transaction hash", { validate: validateTxHash });
    return ["trace", "--chain", chain, "--tx", txHash];
  }

  if (feature === "deploy") {
    const chain = await selectChain(options);
    const deployInput = await collectDeployInput(options);
    const privateKey = await options.prompt.input("Private key", { secret: true, validate: validateHex });
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
      deployInput.flag,
      deployInput.value,
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
    from: await options.prompt.input("From address", { validate: validateAddress }),
    to: await options.prompt.input("To address", { validate: validateAddress }),
    data: await options.prompt.input("Calldata", { defaultValue: "0x", validate: validateHex }),
    valueWei: await options.prompt.input("Value wei", { defaultValue: "0" })
  };
}

async function collectDeployInput(options: InteractiveSessionOptions): Promise<{
  flag: "--artifact" | "--bytecode";
  value: string;
}> {
  while (true) {
    const value = await options.prompt.input("Artifact path or bytecode (0x...)");
    if (value.startsWith("0x")) {
      const error = validateHex(value);
      if (error) {
        options.write(formatStatus(error, "warning"));
        continue;
      }
      return { flag: "--bytecode", value };
    }

    try {
      const artifact = await readArtifactFile(value);
      options.write(formatStatus(`Loaded ${artifact.contractName} (${byteLength(artifact.bytecode)} bytes)`, "success"));
      return { flag: "--artifact", value };
    } catch (err) {
      options.write(formatStatus(err instanceof Error ? err.message : String(err), "warning"));
    }
  }
}

function byteLength(hex: string): string {
  const bytes = hex.startsWith("0x") ? (hex.length - 2) / 2 : hex.length / 2;
  return new Intl.NumberFormat("en-US").format(bytes);
}

async function selectChain(options: InteractiveSessionOptions): Promise<string> {
  return options.prompt.select(
    "Select chain",
    options.chainKeys.map((chainKey) => ({ label: chainKey, value: chainKey }))
  );
}

interface QuestionReader {
  question(prompt: string): Promise<string>;
  pause?(): void;
  resume?(): void;
}

interface TerminalIO {
  input?: typeof stdin;
  write(text: string): void;
}

export class TerminalPrompt implements InteractivePrompt {
  private readonly readline: QuestionReader;
  private readonly terminal: TerminalIO;
  private readonly pendingRawKeys: string[] = [];

  constructor(
    readline: Pick<Interface, "question"> & Partial<Pick<Interface, "pause" | "resume">>,
    terminal: TerminalIO = { input: stdin, write: (text) => stdout.write(text) }
  ) {
    this.readline = readline;
    this.terminal = terminal;
  }

  async select(prompt: string, choices: InteractiveChoice[]): Promise<string> {
    if (choices.length === 0) {
      throw new Error("Cannot render an empty select menu");
    }

    const input = this.terminal.input;
    if (!input || typeof input.setRawMode !== "function") {
      throw new Error("Interactive select requires a TTY with raw mode support");
    }

    let selectedIndex = 0;
    const lineCount = choices.length + 2;
    const wasRaw = input.isRaw;
    this.readline.pause?.();
    input.setRawMode(true);
    input.resume();
    this.write(renderSelect(prompt, choices, selectedIndex));

    try {
      while (true) {
        const key = await this.readRawKey(input);

        if (key === "\u0003") {
          this.write("\n");
          exit(130);
        }
        if (key === "\u001B[A") {
          selectedIndex = selectedIndex === 0 ? choices.length - 1 : selectedIndex - 1;
          this.redrawSelect(lineCount, prompt, choices, selectedIndex);
          continue;
        }
        if (key === "\u001B[B") {
          selectedIndex = (selectedIndex + 1) % choices.length;
          this.redrawSelect(lineCount, prompt, choices, selectedIndex);
          continue;
        }
        if (key === "\r" || key === "\n") {
          const selected = choices[selectedIndex];
          this.clearSelect(lineCount);
          this.write(`${color(prompt, "cyan")}: ${selected.label}\n`);
          return selected.value;
        }
      }
    } finally {
      input.setRawMode(Boolean(wasRaw));
      this.readline.resume?.();
    }
  }

  async input(prompt: string, options?: InteractiveInputOptions): Promise<string> {
    while (true) {
      const suffix = options?.defaultValue ? ` (${options.defaultValue})` : "";
      const answer = await this.readline.question(color(`> ${prompt}${suffix}: `, "green"));
      const value = answer.trim() || options?.defaultValue;
      const finalValue = value ?? "";
      const error = options?.validate?.(finalValue);
      if (!error) {
        return finalValue;
      }

      this.write(`${formatStatus(error, "warning")}\n`);
    }
  }

  private redrawSelect(lineCount: number, prompt: string, choices: InteractiveChoice[], selectedIndex: number): void {
    this.clearSelect(lineCount);
    this.write(renderSelect(prompt, choices, selectedIndex));
  }

  private clearSelect(lineCount: number): void {
    this.write(`\u001B[${lineCount}A\u001B[0J`);
  }

  private write(text: string): void {
    this.terminal.write(text);
  }

  private async readRawKey(input: typeof stdin): Promise<string> {
    const pending = this.pendingRawKeys.shift();
    if (pending !== undefined) {
      return pending;
    }

    const chunk = await new Promise<string>((resolve) => {
      input.once("data", (data) => resolve(String(data)));
    });
    this.pendingRawKeys.push(...parseRawKeys(chunk));
    return this.pendingRawKeys.shift() ?? "";
  }
}

export function validateAddress(value: string): string | undefined {
  return /^0x[0-9a-fA-F]{40}$/.test(value)
    ? undefined
    : "Must be a valid Ethereum address (0x + 40 hex chars)";
}

export function validateTxHash(value: string): string | undefined {
  return /^0x[0-9a-fA-F]{64}$/.test(value)
    ? undefined
    : "Must be a valid transaction hash (0x + 64 hex chars)";
}

export function validateHex(value: string): string | undefined {
  return /^0x[0-9a-fA-F]*$/.test(value)
    ? undefined
    : "Must be valid hex data (0x + hex chars)";
}

function renderSelect(prompt: string, choices: InteractiveChoice[], selectedIndex: number): string {
  return [
    "",
    color(prompt, "cyan"),
    ...choices.map((choice, index) => {
      const selected = index === selectedIndex;
      const marker = selected ? color("❯", "green") : " ";
      const label = selected ? color(choice.label, "bold") : choice.label;
      return `${marker} ${label}`;
    })
  ].join("\n") + "\n";
}

function parseRawKeys(chunk: string): string[] {
  const keys: string[] = [];
  for (let index = 0; index < chunk.length; index++) {
    const nextThree = chunk.slice(index, index + 3);
    if (nextThree === "\u001B[A" || nextThree === "\u001B[B") {
      keys.push(nextThree);
      index += 2;
      continue;
    }
    keys.push(chunk[index]);
  }
  return keys;
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

function formatStatus(message: string, tone: "muted" | "warning" | "success"): string {
  const marker = tone === "warning" ? "!" : tone === "success" ? "✓" : "-";
  return color(`${marker} ${message}`, tone);
}

function color(text: string, tone: "bold" | "cyan" | "green" | "muted" | "warning" | "success"): string {
  if (env.NO_COLOR) {
    return text;
  }

  const codes: Record<typeof tone, [number, number]> = {
    bold: [1, 22],
    cyan: [36, 39],
    green: [32, 39],
    muted: [2, 22],
    warning: [33, 39],
    success: [32, 39]
  };
  const [open, close] = codes[tone];
  return `\u001B[${open}m${text}\u001B[${close}m`;
}
