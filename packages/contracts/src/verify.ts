const VERIFY_POLL_INTERVAL_MS = 3_000;
const VERIFY_TIMEOUT_MS = 120_000;

export interface VerificationRequestInput {
  chainKey: string;
  contractName: string;
  contractAddress: string;
  constructorArgs: string[];
  artifactPath: string;
}

export interface VerificationRequest extends VerificationRequestInput {
  provider: "explorer";
}

export interface VerificationSubmitParams {
  apiUrl: string;
  apiKey: string;
  contractAddress: string;
  sourceCode: string;
  contractName: string;
  compilerVersion: string;
  constructorArgs?: string;
  optimizationUsed?: boolean;
}

export interface VerificationResult {
  status: "success" | "pending" | "failed";
  message: string;
  guid: string;
}

export function buildVerificationRequest(input: VerificationRequestInput): VerificationRequest {
  return {
    provider: "explorer",
    ...input
  };
}

export async function submitVerification(params: VerificationSubmitParams): Promise<string> {
  const body = new URLSearchParams({
    apikey: params.apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: params.contractAddress,
    sourceCode: params.sourceCode,
    codeformat: "solidity-single-file",
    contractname: params.contractName,
    compilerversion: params.compilerVersion,
    optimizationUsed: params.optimizationUsed ? "1" : "0"
  });
  if (params.constructorArgs) {
    body.set("constructorArguements", params.constructorArgs);
  }

  const response = await fetch(params.apiUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Verifier API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json() as { status: string; message: string; result: string };
  if (json.status !== "1") {
    throw new Error(`Verification submission failed: ${json.result}`);
  }

  return json.result;
}

export async function pollVerificationStatus(
  guid: string,
  apiUrl: string,
  apiKey: string,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<VerificationResult> {
  const timeoutMs = options.timeoutMs ?? VERIFY_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? VERIFY_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    const url = new URL(apiUrl);
    url.searchParams.set("module", "contract");
    url.searchParams.set("action", "checkverifystatus");
    url.searchParams.set("guid", guid);
    url.searchParams.set("apikey", apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      continue;
    }

    const json = await response.json() as { status: string; message: string; result: string };
    const result = json.result ?? "";

    if (isPending(result)) {
      continue;
    }
    if (result.toLowerCase().startsWith("pass") || result.toLowerCase().startsWith("already verified")) {
      return { status: "success", message: result, guid };
    }

    return { status: "failed", message: result, guid };
  }

  return { status: "pending", message: "Timed out waiting for verification result", guid };
}

function isPending(result: string): boolean {
  const lower = result.toLowerCase();
  return (
    lower.includes("pending") ||
    lower.includes("in queue") ||
    lower.includes("currently")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
