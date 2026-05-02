import { runCli } from "./router.ts";

async function main(args: string[]): Promise<void> {
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
