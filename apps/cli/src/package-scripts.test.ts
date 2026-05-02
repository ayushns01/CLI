import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8")
) as {
  scripts?: Record<string, string>;
};

test("package exposes cli script for npm run cli -- menu", () => {
  assert.equal(packageJson.scripts?.cli, "node --experimental-strip-types apps/cli/src/index.ts");
});
