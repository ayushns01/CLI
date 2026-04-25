import type { EncodedCalldataParts } from "../../../../../../packages/tx/src/calldata.ts";

export function renderCalldataDecodeResult(decoded: EncodedCalldataParts): string {
  return [
    `selector: ${decoded.selector}`,
    ...decoded.words.map((word, index) => `word[${index}]: ${word}`)
  ].join("\n");
}
