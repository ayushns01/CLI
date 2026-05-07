import type { AddressEntry } from "../../../../packages/memory/src/models.ts";

export function renderAddressEntry(entry: AddressEntry): string {
  return [
    `name: ${entry.name}`,
    `address: ${entry.address}`,
    `chain: ${entry.chainKey || "all chains"}`
  ].join("\n");
}

export function renderAddressList(entries: AddressEntry[]): string {
  if (entries.length === 0) {
    return "Address book is empty.";
  }

  const maxName = Math.max(...entries.map(e => e.name.length), 4);
  const maxAddr = Math.max(...entries.map(e => e.address.length), 7);

  const header = `NAME${" ".repeat(maxName - 4)}   ADDRESS${" ".repeat(maxAddr - 7)}   CHAIN`;
  const rows = entries.map(e => {
    const chainStr = e.chainKey || "all chains";
    const namePad = " ".repeat(maxName - e.name.length);
    const addrPad = " ".repeat(maxAddr - e.address.length);
    return `${e.name}${namePad}   ${e.address}${addrPad}   ${chainStr}`;
  });

  return [header, ...rows].join("\n");
}
