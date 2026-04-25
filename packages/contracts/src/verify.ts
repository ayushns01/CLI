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

export function buildVerificationRequest(input: VerificationRequestInput): VerificationRequest {
  return {
    provider: "explorer",
    ...input
  };
}
