import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyRpcError,
  createRpcManager,
  RpcProviderError,
  type RpcProvider
} from "./manager.ts";

test("selectProvider chooses the fastest healthy provider", async () => {
  const providers: RpcProvider[] = [
    provider("slow", 80),
    provider("fast", 10),
    provider("medium", 40)
  ];

  const manager = createRpcManager(providers);
  const selected = await manager.selectProvider();

  assert.equal(selected.name, "fast");
});

test("selectProvider skips unhealthy providers", async () => {
  const providers: RpcProvider[] = [
    provider("fast-broken", 5, "timeout"),
    provider("healthy", 25)
  ];

  const manager = createRpcManager(providers);
  const selected = await manager.selectProvider();

  assert.equal(selected.name, "healthy");
});

test("executeRead retries safe read calls on the next healthy provider", async () => {
  const providers: RpcProvider[] = [
    provider("first", 5),
    provider("second", 20)
  ];
  const manager = createRpcManager(providers);
  const usedProviders: string[] = [];

  const result = await manager.executeRead(async (selected) => {
    usedProviders.push(selected.name);
    if (selected.name === "first") {
      throw new RpcProviderError("rate-limit", "rate limited");
    }
    return `ok:${selected.name}`;
  });

  assert.equal(result, "ok:second");
  assert.deepEqual(usedProviders, ["first", "second"]);
});

test("classifyRpcError maps common failures to structured categories", () => {
  assert.equal(classifyRpcError(new Error("request timeout")), "timeout");
  assert.equal(classifyRpcError(new Error("429 too many requests")), "rate-limit");
  assert.equal(classifyRpcError(new Error("invalid json response")), "bad-response");
});

function provider(name: string, latencyMs: number, failure?: "timeout" | "rate-limit" | "bad-response"): RpcProvider {
  return {
    name,
    url: `https://${name}.example`,
    measureLatency: async () => {
      if (failure) {
        throw new RpcProviderError(failure, `${name} failed`);
      }
      return latencyMs;
    }
  };
}
