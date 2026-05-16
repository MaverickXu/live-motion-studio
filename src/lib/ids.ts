export function makeContentId(): string {
  const webCrypto = globalThis.crypto;

  if (typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  const bytes = webCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = bytes[6] & 0x0f | 0x40;
  bytes[8] = bytes[8] & 0x3f | 0x80;

  const hex = Array.from(bytes, (byte: number) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function safeBaseName(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "live-photo";
}
