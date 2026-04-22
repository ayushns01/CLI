import { renderRootHelp } from "./commands/root.ts";

function main(args: string[]): void {
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    console.log(renderRootHelp());
    return;
  }

  const [command] = args;

  console.error(`Command group '${command}' is not implemented yet.`);
  process.exitCode = 1;
}

main(process.argv.slice(2));
