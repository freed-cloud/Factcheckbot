const encoder = new TextEncoder();

/**
 * Controleert de handtekening die Meta met elk webhookbericht meestuurt
 * (header X-Hub-Signature-256: "sha256=<hex>"). Zo weten we zeker dat het
 * bericht echt van Meta komt en onderweg niet is aangepast.
 */
export async function isValidSignature(
  rawBody: ArrayBuffer,
  header: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!header || !appSecret) return false;
  const match = /^sha256=([0-9a-fA-F]{64})$/.exec(header.trim());
  if (!match?.[1]) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  // verify() vergelijkt in constante tijd, dus de duur verraadt niets.
  return crypto.subtle.verify("HMAC", key, hexToBytes(match[1]), rawBody);
}

/** Vergelijkt twee teksten zonder dat de duur iets verraadt over de inhoud. */
export function safeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return difference === 0;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
