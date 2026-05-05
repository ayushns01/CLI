/**
 * Real viem-backed RPC clients.
 *
 * Bridges the deterministic core's NativeBalanceClient interface to a real
 * viem PublicClient that hits an HTTP RPC endpoint.
 *
 * The deterministic core stays viem-free; this is the seam where real
 * network access enters the system.
 */

import { createPublicClient, createWalletClient, http, BaseError, ContractFunctionRevertedError, parseEther, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Abi, Address, Hex } from "viem";

export interface BalanceClient {
  getBalance(address: string): Promise<bigint>;
}

export interface ViemClientOptions {
  rpcUrl: string;
  timeoutMs?: number;
}

export function createViemBalanceClient(options: ViemClientOptions): BalanceClient {
  const client = createPublicClient({
    transport: http(options.rpcUrl, { timeout: options.timeoutMs ?? 10_000 })
  });

  return {
    async getBalance(address: string): Promise<bigint> {
      return client.getBalance({ address: address as Address });
    }
  };
}

export interface SimulationRequest {
  chainKey: string;
  from: string;
  to: string;
  data: string;
  valueWei: bigint;
}

export interface SimulationSuccess {
  success: true;
  gasUsed: bigint;
  stateChanges: string[];
}

export interface SimulationFailure {
  success: false;
  revertData?: string;
}

export type RawSimulationResult = SimulationSuccess | SimulationFailure;

export interface SimulationClient {
  simulate(request: SimulationRequest): Promise<RawSimulationResult>;
}

/**
 * Build a viem-backed simulation client. Uses eth_call + eth_estimateGas to
 * dry-run a transaction without broadcasting. On revert, attempts to extract
 * the raw revert data so the deterministic core can decode the reason.
 */
export function createViemSimulationClient(options: ViemClientOptions): SimulationClient {
  const client = createPublicClient({
    transport: http(options.rpcUrl, { timeout: options.timeoutMs ?? 10_000 })
  });

  return {
    async simulate(request: SimulationRequest): Promise<RawSimulationResult> {
      try {
        const gasUsed = await client.estimateGas({
          account: request.from as Address,
          to: request.to as Address,
          data: request.data as Hex,
          value: request.valueWei
        });

        await client.call({
          account: request.from as Address,
          to: request.to as Address,
          data: request.data as Hex,
          value: request.valueWei
        });

        return { success: true, gasUsed, stateChanges: [] };
      } catch (err) {
        if (isLikelyViemTransportError(err)) {
          throw err;
        }
        return { success: false, revertData: extractRevertData(err) };
      }
    }
  };
}

export interface GasEstimateRequest {
  from: string;
  to: string;
  data: string;
  valueWei: bigint;
}

export interface GasEstimateData {
  gasLimit: bigint;
  maxFeePerGasWei: bigint;
  maxPriorityFeePerGasWei?: bigint;
}

export interface GasClient {
  estimate(request: GasEstimateRequest): Promise<GasEstimateData>;
}

/**
 * Build a viem-backed gas client that combines eth_estimateGas with
 * fee data (EIP-1559 maxFeePerGas / maxPriorityFeePerGas, falling back
 * to legacy gasPrice on chains without 1559).
 */
export function createViemGasClient(options: ViemClientOptions): GasClient {
  const client = createPublicClient({
    transport: http(options.rpcUrl, { timeout: options.timeoutMs ?? 10_000 })
  });

  return {
    async estimate(request: GasEstimateRequest): Promise<GasEstimateData> {
      const gasLimit = await client.estimateGas({
        account: request.from as Address,
        to: request.to as Address,
        data: request.data as Hex,
        value: request.valueWei
      });

      try {
        const fees = await client.estimateFeesPerGas();
        return {
          gasLimit,
          maxFeePerGasWei: fees.maxFeePerGas,
          maxPriorityFeePerGasWei: fees.maxPriorityFeePerGas
        };
      } catch {
        const gasPrice = await client.getGasPrice();
        return { gasLimit, maxFeePerGasWei: gasPrice };
      }
    }
  };
}

export interface TraceCall {
  type: string;
  from: string;
  to?: string;
  input: string;
  selector?: string;
  valueWei?: bigint;
  gasUsed?: bigint;
  error?: string;
  revertData?: string;
  calls?: TraceCall[];
}

export interface TraceResult {
  txHash?: string;
  root: TraceCall;
}

export interface TraceClient {
  getTrace(txHash: string): Promise<TraceResult>;
}

/**
 * Build a viem-backed trace client. Uses getTransaction + getTransactionReceipt
 * to assemble a single-frame trace. Most public RPCs do not expose
 * debug_traceTransaction, so we provide receipt-derived information instead:
 * from/to/value/data/gasUsed plus revert status.
 */
export function createViemTraceClient(options: ViemClientOptions): TraceClient {
  const client = createPublicClient({
    transport: http(options.rpcUrl, { timeout: options.timeoutMs ?? 10_000 })
  });

  return {
    async getTrace(txHash: string): Promise<TraceResult> {
      const hash = txHash as Hex;
      const [tx, receipt] = await Promise.all([
        client.getTransaction({ hash }),
        client.getTransactionReceipt({ hash })
      ]);

      const root: TraceCall = {
        type: tx.to === null ? "CREATE" : "CALL",
        from: tx.from,
        to: tx.to ?? receipt.contractAddress ?? undefined,
        input: tx.input,
        valueWei: tx.value,
        gasUsed: receipt.gasUsed,
        error: receipt.status === "reverted" ? "execution reverted" : undefined
      };

      return { txHash: receipt.transactionHash, root };
    }
  };
}

export interface DeployRequest {
  bytecode: string;
  valueWei?: bigint;
}

export interface DeployResult {
  transactionHash: string;
  contractAddress: string;
  blockNumber: bigint;
}

export interface DeployClient {
  deploy(request: DeployRequest): Promise<DeployResult>;
}

export interface AbiInput {
  name?: string;
  type: string;
}

export interface ContractReadRequest {
  address: string;
  abi: unknown[];
  functionName: string;
  args?: unknown[];
}

export interface ContractWriteRequest extends ContractReadRequest {
  privateKey: string;
  valueWei?: bigint;
}

export interface ContractReadResult {
  result: unknown;
}

export interface ContractWriteResult {
  transactionHash: string;
  blockNumber: bigint;
}

export interface ContractClient {
  read(request: ContractReadRequest): Promise<ContractReadResult>;
  write(request: ContractWriteRequest): Promise<ContractWriteResult>;
}

export interface ViemDeployClientOptions extends ViemClientOptions {
  privateKey: string;   // hex-encoded, with or without 0x prefix
}

/**
 * Build a viem-backed deploy client. Signs and broadcasts a contract creation
 * transaction with the supplied private key, then waits for the receipt and
 * returns the deployed address.
 *
 * IMPORTANT: this performs a real broadcast and consumes real gas on the
 * target chain. The caller is responsible for ensuring the chain is a
 * testnet (or the user has explicitly approved a mainnet deploy).
 */
export function createViemDeployClient(options: ViemDeployClientOptions): DeployClient {
  const transport = http(options.rpcUrl, { timeout: options.timeoutMs ?? 30_000 });
  const account = privateKeyToAccount(normalizePrivateKey(options.privateKey));

  const publicClient = createPublicClient({ transport });
  const wallet = createWalletClient({ account, transport });

  return {
    async deploy(request: DeployRequest): Promise<DeployResult> {
      const txHash = await wallet.deployContract({
        bytecode: request.bytecode as Hex,
        abi: [],
        chain: null,
        value: request.valueWei
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (!receipt.contractAddress) {
        throw new Error(`Deploy transaction ${txHash} did not produce a contract address`);
      }

      return {
        transactionHash: receipt.transactionHash,
        contractAddress: receipt.contractAddress,
        blockNumber: receipt.blockNumber
      };
    }
  };
}

export function createViemContractClient(options: ViemClientOptions): ContractClient {
  const transport = http(options.rpcUrl, { timeout: options.timeoutMs ?? 30_000 });
  const publicClient = createPublicClient({ transport });

  return {
    async read(request: ContractReadRequest): Promise<ContractReadResult> {
      const fragment = findAbiFunction(request.abi, request.functionName);
      const args = coerceArgs(fragment.inputs ?? [], request.args ?? []);
      const result = await publicClient.readContract({
        address: request.address as Address,
        abi: request.abi as Abi,
        functionName: request.functionName,
        args
      });
      return { result };
    },

    async write(request: ContractWriteRequest): Promise<ContractWriteResult> {
      const fragment = findAbiFunction(request.abi, request.functionName);
      const args = coerceArgs(fragment.inputs ?? [], request.args ?? []);
      const account = privateKeyToAccount(normalizePrivateKey(request.privateKey));
      const wallet = createWalletClient({ account, transport });
      const transactionHash = await wallet.writeContract({
        account,
        address: request.address as Address,
        abi: request.abi as Abi,
        functionName: request.functionName,
        args,
        chain: null,
        value: request.valueWei
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      };
    }
  };
}

export function coerceArgs(inputs: AbiInput[], rawArgs: unknown[]): unknown[] {
  if (inputs.length !== rawArgs.length) {
    throw new Error(`Function expects ${inputs.length} arguments, received ${rawArgs.length}`);
  }

  return inputs.map((input, index) => coerceArg(input.type, rawArgs[index]));
}

function coerceArg(type: string, value: unknown): unknown {
  if (/^u?int([0-9]*)?$/.test(type)) {
    if (typeof value === "bigint") {
      return value;
    }
    if (typeof value === "number" && Number.isInteger(value)) {
      return BigInt(value);
    }
    if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
      return BigInt(value.trim());
    }
    throw new Error(`Invalid ${type} argument: ${String(value)}`);
  }

  if (type === "bool") {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
    throw new Error(`Invalid bool argument: ${String(value)}`);
  }

  return value;
}

function findAbiFunction(abi: unknown[], functionName: string): { inputs?: AbiInput[] } {
  const fragment = abi.find((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const candidate = entry as { type?: unknown; name?: unknown };
    return candidate.type === "function" && candidate.name === functionName;
  });

  if (!fragment || typeof fragment !== "object") {
    throw new Error(`Function ${functionName} not found in ABI`);
  }

  const inputs = (fragment as { inputs?: unknown }).inputs;
  return {
    inputs: Array.isArray(inputs) ? inputs.filter(isAbiInput) : []
  };
}

function isAbiInput(value: unknown): value is AbiInput {
  return Boolean(value && typeof value === "object" && typeof (value as { type?: unknown }).type === "string");
}

function normalizePrivateKey(value: string): Hex {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(prefixed)) {
    throw new Error("Invalid private key: must be 32 bytes hex");
  }
  return prefixed as Hex;
}

export function isLikelyViemTransportError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current !== undefined && current !== null && depth < 8; depth++) {
    const record = current as { name?: unknown; message?: unknown; cause?: unknown };
    const name = typeof record.name === "string" ? record.name.toLowerCase() : "";
    const message = typeof record.message === "string" ? record.message.toLowerCase() : String(current).toLowerCase();

    if (
      name.includes("httprequesterror") ||
      message.includes("http request failed") ||
      message.includes("fetch failed") ||
      message.includes("enotfound") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("etimedout") ||
      message.includes("network unreachable")
    ) {
      return true;
    }

    current = record.cause;
  }

  return false;
}

function extractRevertData(err: unknown): string | undefined {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError && reverted.data) {
      return reverted.data.errorName === "Error" ? reverted.raw : reverted.raw;
    }
    const raw = (err as unknown as { data?: string }).data;
    if (typeof raw === "string") return raw;
  }
  return undefined;
}

// ─── ENS resolution ──────────────────────────────────────────────────────────

export function looksLikeEns(value: string): boolean {
  return /^[a-zA-Z0-9-]+\.eth$/.test(value.trim());
}

export async function resolveEnsAddress(name: string, mainnetRpcUrl: string): Promise<string> {
  const client = createPublicClient({
    transport: http(mainnetRpcUrl, { timeout: 10_000 })
  });
  const address = await client.getEnsAddress({ name: name.trim() });
  if (!address) {
    throw new Error(`ENS name '${name}' could not be resolved to an address`);
  }
  return address;
}

// ─── Send ETH ────────────────────────────────────────────────────────────────

export interface SendRequest {
  to: string;
  valueWei: bigint;
}

export interface SendResult {
  transactionHash: string;
  blockNumber: bigint;
  from: string;
  to: string;
  valueWei: bigint;
}

export interface SendClient {
  getFrom(): string;
  send(request: SendRequest): Promise<SendResult>;
}

export function createViemSendClient(options: ViemDeployClientOptions): SendClient {
  const transport = http(options.rpcUrl, { timeout: options.timeoutMs ?? 30_000 });
  const account = privateKeyToAccount(normalizePrivateKey(options.privateKey));
  const publicClient = createPublicClient({ transport });
  const wallet = createWalletClient({ account, transport });

  return {
    getFrom: () => account.address,

    async send(request: SendRequest): Promise<SendResult> {
      const txHash = await wallet.sendTransaction({
        account,
        to: request.to as Address,
        value: request.valueWei,
        chain: null
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        from: account.address,
        to: request.to,
        valueWei: request.valueWei
      };
    }
  };
}

// ─── ERC-20 token transfers ───────────────────────────────────────────────────

const ERC20_ABI = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
] as const;

export interface TokenInfo {
  symbol: string;
  decimals: number;
}

export interface TokenTransferRequest {
  tokenAddress: string;
  to: string;
  amountWei: bigint;
}

export interface TokenTransferResult {
  transactionHash: string;
  blockNumber: bigint;
  from: string;
  to: string;
  tokenAddress: string;
  amountWei: bigint;
}

export interface TokenClient {
  getInfo(tokenAddress: string): Promise<TokenInfo>;
  transfer(request: TokenTransferRequest): Promise<TokenTransferResult>;
}

export function createViemTokenClient(options: ViemDeployClientOptions): TokenClient {
  const transport = http(options.rpcUrl, { timeout: options.timeoutMs ?? 30_000 });
  const account = privateKeyToAccount(normalizePrivateKey(options.privateKey));
  const publicClient = createPublicClient({ transport });
  const wallet = createWalletClient({ account, transport });

  return {
    async getInfo(tokenAddress: string): Promise<TokenInfo> {
      const [symbol, decimals] = await Promise.all([
        publicClient.readContract({ address: tokenAddress as Address, abi: ERC20_ABI, functionName: "symbol" }),
        publicClient.readContract({ address: tokenAddress as Address, abi: ERC20_ABI, functionName: "decimals" })
      ]);
      return { symbol: String(symbol), decimals: Number(decimals) };
    },

    async transfer(request: TokenTransferRequest): Promise<TokenTransferResult> {
      const txHash = await wallet.writeContract({
        account,
        address: request.tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [request.to as Address, request.amountWei],
        chain: null
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        from: account.address,
        to: request.to,
        tokenAddress: request.tokenAddress,
        amountWei: request.amountWei
      };
    }
  };
}

// ─── Parsing helpers (re-exported for CLI use) ───────────────────────────────

export function parseEthAmount(value: string): bigint {
  return parseEther(value as `${number}`);
}

export function parseTokenAmount(value: string, decimals: number): bigint {
  return parseUnits(value as `${number}`, decimals);
}
