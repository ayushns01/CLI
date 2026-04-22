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
