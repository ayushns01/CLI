export interface EncodedCalldataParts {
  selector: string;
  words: string[];
}

export function encodeCalldata(parts: EncodedCalldataParts): string {
  const selector = normalizeHex(parts.selector);
  if (selector.length !== 10) {
    throw new Error("Calldata selector must be 4 bytes");
  }

  return `0x${selector.slice(2)}${parts.words.map(normalizeWord).join("")}`;
}

export function decodeCalldata(calldata: string): EncodedCalldataParts {
  const normalized = normalizeHex(calldata);
  if (normalized.length < 10) {
    throw new Error("Calldata must include a 4-byte selector");
  }

  const payload = normalized.slice(10);
  if (payload.length % 64 !== 0) {
    throw new Error("Calldata payload must be 32-byte word aligned");
  }

  const words: string[] = [];
  for (let index = 0; index < payload.length; index += 64) {
    words.push(payload.slice(index, index + 64));
  }

  return {
    selector: normalized.slice(0, 10),
    words
  };
}

function normalizeHex(value: string): string {
  const normalized = value.startsWith("0x") ? value.toLowerCase() : `0x${value.toLowerCase()}`;
  if (!/^0x[0-9a-f]*$/.test(normalized)) {
    throw new Error(`Invalid hex value: ${value}`);
  }
  return normalized;
}

function normalizeWord(value: string): string {
  const word = value.startsWith("0x") ? value.slice(2).toLowerCase() : value.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(word)) {
    throw new Error("Calldata words must be exactly 32 bytes");
  }
  return word;
}
