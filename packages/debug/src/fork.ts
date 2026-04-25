export interface ForkStartRequest {
  chainKey: string;
  rpcUrl: string;
  blockNumber?: bigint;
  port: number;
}

export interface ForkProcess {
  id: string;
  rpcUrl: string;
  blockNumber?: bigint;
}

export interface ForkRunner {
  start(request: ForkStartRequest): Promise<ForkProcess>;
  stop(id: string): Promise<void>;
}

export interface ForkSession {
  id: string;
  chainKey: string;
  sourceRpcUrl: string;
  rpcUrl: string;
  blockNumber?: bigint;
  port: number;
  stop(): Promise<void>;
}

export interface StartForkInput extends Omit<ForkStartRequest, "port"> {
  port?: number;
  runner: ForkRunner;
}

export async function startFork(input: StartForkInput): Promise<ForkSession> {
  const request: ForkStartRequest = {
    chainKey: input.chainKey,
    rpcUrl: input.rpcUrl,
    blockNumber: input.blockNumber,
    port: input.port ?? 8545
  };
  const process = await input.runner.start(request);

  return {
    id: process.id,
    chainKey: input.chainKey,
    sourceRpcUrl: input.rpcUrl,
    rpcUrl: process.rpcUrl,
    blockNumber: process.blockNumber ?? input.blockNumber,
    port: request.port,
    stop: async () => input.runner.stop(process.id)
  };
}
