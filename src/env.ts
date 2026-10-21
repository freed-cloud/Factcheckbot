import type { SeenMessages } from "./seen-messages";

/**
 * Alles wat de bot van Cloudflare meekrijgt.
 *
 * De vijf geheimen zet je bij Cloudflare (Worker > Settings > Variables and Secrets),
 * nooit in de code of in GitHub. De instellingen staan in wrangler.jsonc.
 */
export interface Env {
  // Geheimen
  WHATSAPP_TOKEN: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_VERIFY_TOKEN: string;
  META_APP_SECRET: string;
  PERPLEXITY_API_KEY: string;

  // Instellingen (wrangler.jsonc > vars)
  PERPLEXITY_PRESET?: string;
  GRAPH_API_VERSION?: string;

  // Kleine opslag waarmee de bot dubbel bezorgde berichten herkent
  SEEN_MESSAGES?: DurableObjectNamespace<SeenMessages>;
}

export const REQUIRED_SECRETS = [
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TOKEN",
  "META_APP_SECRET",
  "PERPLEXITY_API_KEY",
] as const;

/** Standaardinstellingen als er niets in wrangler.jsonc staat. */
export const DEFAULT_PERPLEXITY_PRESET = "low";
export const DEFAULT_GRAPH_API_VERSION = "v26.0";

/** Namen van geheimen die nog niet (of leeg) zijn ingesteld. Nooit de waarden zelf. */
export function missingSecrets(env: Env): string[] {
  return REQUIRED_SECRETS.filter((name) => {
    const value: unknown = env[name];
    return typeof value !== "string" || value.trim() === "";
  });
}

export function perplexityPreset(env: Env): string {
  return env.PERPLEXITY_PRESET?.trim() || DEFAULT_PERPLEXITY_PRESET;
}

export function graphApiVersion(env: Env): string {
  return env.GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION;
}
