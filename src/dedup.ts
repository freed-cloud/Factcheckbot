import type { Env } from "./env";
import { errorName, log } from "./log";

/** Naam van de ene opslag waarin alle bericht-codes staan. */
const STORE_NAME = "whatsapp-message-ids";

/**
 * Geeft true als dit bericht voor het eerst binnenkomt en false als Meta het
 * opnieuw stuurt. Werkt de opslag even niet, dan laten we het bericht door:
 * liever één keer te vaak antwoorden dan een vraag missen.
 */
export async function isFirstDelivery(env: Env, messageId: string): Promise<boolean> {
  const namespace = env.SEEN_MESSAGES;
  if (!namespace) return true;
  try {
    const key = await sha256Hex(messageId);
    const store = namespace.get(namespace.idFromName(STORE_NAME));
    return await store.firstTime(key);
  } catch (error) {
    log("dedup_unavailable", { error: errorName(error) }, "warn");
    return true;
  }
}

/** Maakt van een tekst een onherkenbare code (SHA-256, als hex). */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
