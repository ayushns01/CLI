import { createTerminalPrompt, runInteractiveSession } from "./interactive.ts";
import { createDefaultCliDependencies, runCli } from "./router.ts";

async function main(args: string[]): Promise<void> {
  if (args[0] === "interactive" || args[0] === "menu") {
    const deps = createDefaultCliDependencies();
    const terminal = createTerminalPrompt();
    try {
      await runInteractiveSession({
        prompt: terminal.prompt,
        write: (line) => console.log(line),
        runCommand: (commandArgs) => runCli(commandArgs, deps),
        chainKeys: deps.chainRegistry.all().map((chain) => chain.key)
      });
    } finally {
      terminal.close();
    }
    return;
  }

  const result = await runCli(args);

  if (result.stdout) {
    console.log(result.stdout);
  }
  if (result.stderr) {
    console.error(result.stderr);
  }

  process.exitCode = result.exitCode;
}

await main(process.argv.slice(2));
