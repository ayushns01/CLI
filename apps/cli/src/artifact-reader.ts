import { readFile } from "node:fs/promises";

import {
  parseContractArtifact,
  type ContractArtifact
} from "../../../packages/contracts/src/artifact-loader.ts";

export async function readArtifactFile(filePath: string): Promise<ContractArtifact> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    throw new Error(`Cannot read file: ${filePath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Not valid JSON: ${filePath}`);
  }

  return parseContractArtifact(parsed);
}
