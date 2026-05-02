import test from "node:test";
import assert from "node:assert/strict";

import { runInteractiveSession, type InteractivePrompt } from "./interactive.ts";

test("interactive menu routes Check balance selection", async () => {
  const calls: string[][] = [];
  const output: string[] = [];

  await runInteractiveSession({
    prompt: scriptedPrompt(["balance", "sepolia", "0xabc", "exit"]),
    write: (line) => output.push(line),
    runCommand: async (args) => {
      calls.push(args);
      return { stdout: "chain: sepolia\nbalance: 1 ETH", stderr: "", exitCode: 0 };
    },
    chainKeys: ["sepolia", "base-sepolia"]
  });

  assert.deepEqual(calls, [["balance", "--chain", "sepolia", "--address", "0xabc"]]);
  assert(output.some((line) => line.includes("+------------------------------------------------------------+")));
  assert(output.some((line) => line.includes("AI EVM Developer Workstation")));
  assert(output.some((line) => line.includes("Command output")));
  assert(output.some((line) => line.includes("balance: 1 ETH")));
});

test("interactive menu routes Check all testnet balances selection", async () => {
  const calls: string[][] = [];

  await runInteractiveSession({
    prompt: scriptedPrompt(["allbal", "0xabc", "exit"]),
    write: () => {},
    runCommand: async (args) => {
      calls.push(args);
      return { stdout: "chain: sepolia", stderr: "", exitCode: 0 };
    },
    chainKeys: ["sepolia"]
  });

  assert.deepEqual(calls, [["allbal", "--testnet", "--address", "0xabc"]]);
});

test("interactive menu routes Estimate gas selection", async () => {
  const calls: string[][] = [];

  await runInteractiveSession({
    prompt: scriptedPrompt(["gas", "sepolia", "0xfrom", "0xto", "0x", "0", "exit"]),
    write: () => {},
    runCommand: async (args) => {
      calls.push(args);
      return { stdout: "gasLimit: 21000", stderr: "", exitCode: 0 };
    },
    chainKeys: ["sepolia"]
  });

  assert.deepEqual(calls, [
    [
      "gas",
      "estimate",
      "--chain",
      "sepolia",
      "--from",
      "0xfrom",
      "--to",
      "0xto",
      "--data",
      "0x",
      "--value-wei",
      "0"
    ]
  ]);
});

test("interactive menu routes Simulate transaction selection", async () => {
  const calls: string[][] = [];

  await runInteractiveSession({
    prompt: scriptedPrompt(["simulate", "sepolia", "0xfrom", "0xto", "0x", "0", "exit"]),
    write: () => {},
    runCommand: async (args) => {
      calls.push(args);
      return { stdout: "simulation: success", stderr: "", exitCode: 0 };
    },
    chainKeys: ["sepolia"]
  });

  assert.deepEqual(calls, [
    [
      "simulate",
      "--chain",
      "sepolia",
      "--from",
      "0xfrom",
      "--to",
      "0xto",
      "--data",
      "0x",
      "--value-wei",
      "0"
    ]
  ]);
});

test("interactive menu routes Trace transaction selection", async () => {
  const calls: string[][] = [];

  await runInteractiveSession({
    prompt: scriptedPrompt(["trace", "sepolia", "0xhash", "exit"]),
    write: () => {},
    runCommand: async (args) => {
      calls.push(args);
      return { stdout: "transaction: 0xhash", stderr: "", exitCode: 0 };
    },
    chainKeys: ["sepolia"]
  });

  assert.deepEqual(calls, [["trace", "--chain", "sepolia", "--tx", "0xhash"]]);
});

test("interactive menu cancels Deploy contract when user does not confirm broadcast", async () => {
  const calls: string[][] = [];
  const output: string[] = [];

  await runInteractiveSession({
    prompt: scriptedPrompt(["deploy", "sepolia", "0x60006000f3", "0xkey", "no", "exit"]),
    write: (line) => output.push(line),
    runCommand: async (args) => {
      calls.push(args);
      return { stdout: "deployed", stderr: "", exitCode: 0 };
    },
    chainKeys: ["sepolia"]
  });

  assert.deepEqual(calls, []);
  assert(output.some((line) => line.includes("Deploy cancelled")));
});

test("interactive menu routes Deploy contract selection only after confirmation", async () => {
  const calls: string[][] = [];

  await runInteractiveSession({
    prompt: scriptedPrompt(["deploy", "sepolia", "0x60006000f3", "0xkey", "yes", "exit"]),
    write: () => {},
    runCommand: async (args) => {
      calls.push(args);
      return { stdout: "deployed", stderr: "", exitCode: 0 };
    },
    chainKeys: ["sepolia"]
  });

  assert.deepEqual(calls, [
    [
      "deploy",
      "--chain",
      "sepolia",
      "--bytecode",
      "0x60006000f3",
      "--private-key",
      "0xkey",
      "--confirm-broadcast"
    ]
  ]);
});

function scriptedPrompt(answers: string[]): InteractivePrompt {
  return {
    select: async () => {
      const answer = answers.shift();
      if (answer === undefined) {
        throw new Error("No scripted select answer left");
      }
      return answer;
    },
    input: async () => {
      const answer = answers.shift();
      if (answer === undefined) {
        throw new Error("No scripted input answer left");
      }
      return answer;
    }
  };
}
