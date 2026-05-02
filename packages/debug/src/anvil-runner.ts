import { spawn, type ChildProcess } from "node:child_process";

import type { ForkProcess, ForkRunner, ForkStartRequest } from "./fork.ts";

const ANVIL_START_TIMEOUT_MS = 15_000;
const ANVIL_POLL_INTERVAL_MS = 250;
const ANVIL_ERROR_OUTPUT_LIMIT = 1_200;

export class AnvilForkRunner implements ForkRunner {
  private processes: Map<string, ChildProcess>;

  constructor() {
    this.processes = new Map();
  }

  async start(request: ForkStartRequest): Promise<ForkProcess> {
    const id = `${request.chainKey}:${request.port}`;
    const args = [
      "--fork-url",
      request.rpcUrl,
      "--port",
      String(request.port)
    ];
    if (request.blockNumber !== undefined) {
      args.push("--fork-block-number", request.blockNumber.toString());
    }

    const child = spawn("anvil", args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    const output: string[] = [];
    child.stdout?.on("data", (chunk) => output.push(String(chunk)));
    child.stderr?.on("data", (chunk) => output.push(String(chunk)));

    try {
      await waitForAnvil(child, request.port, output);
    } catch (err) {
      child.kill("SIGTERM");
      if (err instanceof Error && /ENOENT/.test(err.message)) {
        throw new Error("Anvil not installed. Install Foundry: https://getfoundry.sh");
      }
      throw err;
    }

    this.processes.set(id, child);
    return {
      id,
      rpcUrl: `http://127.0.0.1:${request.port}`,
      blockNumber: request.blockNumber
    };
  }

  async stop(id: string): Promise<void> {
    const process = this.processes.get(id);
    if (!process) {
      return;
    }
    process.kill("SIGTERM");
    this.processes.delete(id);
  }
}

async function waitForAnvil(child: ChildProcess, port: number, output: string[]): Promise<void> {
  const rpcUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + ANVIL_START_TIMEOUT_MS;
  let spawnError: Error | undefined;
  let exitCode: number | null | undefined;

  child.once("error", (err) => {
    spawnError = err;
  });
  child.once("exit", (code) => {
    exitCode = code;
  });

  while (Date.now() < deadline) {
    if (spawnError) {
      throw spawnError;
    }
    const observedExitCode = exitCode ?? child.exitCode;
    if (observedExitCode !== undefined && observedExitCode !== null) {
      throw new Error(`Anvil exited before ready with code ${observedExitCode}: ${formatProcessOutput(output)}`);
    }
    if (await isAnvilReady(rpcUrl)) {
      return;
    }
    await sleep(ANVIL_POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for Anvil on ${rpcUrl}: ${formatProcessOutput(output)}`);
}

async function isAnvilReady(rpcUrl: string): Promise<boolean> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] })
    });
    if (!response.ok) {
      return false;
    }
    const body = await response.json() as { result?: unknown };
    return typeof body.result === "string";
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatProcessOutput(output: string[]): string {
  const text = output.join("").trim();
  if (text.length <= ANVIL_ERROR_OUTPUT_LIMIT) {
    return text;
  }
  return `${text.slice(0, ANVIL_ERROR_OUTPUT_LIMIT)}...`;
}
