import test from "node:test";
import assert from "node:assert/strict";

import { renderRootHelp } from "./root.ts";

test("renderRootHelp lists the planned top-level command groups", () => {
  const help = renderRootHelp();

  assert.match(help, /wallet/);
  assert.match(help, /chain/);
  assert.match(help, /contract/);
  assert.match(help, /tx/);
  assert.match(help, /debug/);
  assert.match(help, /agent/);
  assert.match(help, /monitor/);
});

test("renderRootHelp lists currently wired terminal commands", () => {
  const help = renderRootHelp();

  assert.match(help, /balance --chain/);
  assert.match(help, /allbal --testnet/);
  assert.match(help, /gas estimate/);
  assert.match(help, /trace --chain/);
  assert.match(help, /deploy --chain/);
  assert.match(help, /interactive/);
  assert.match(help, /menu/);
});

test("renderRootHelp documents workspace config support", () => {
  const help = renderRootHelp();

  assert.match(help, /\.chainmind\.yaml/);
  assert.match(help, /CHAINMIND_ENV/);
});
