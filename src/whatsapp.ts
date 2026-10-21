import { graphApiVersion, type Env } from "./env";
import { errorName, log } from "./log";
import type { IncomingMessage } from "./webhook";

/** Naar wie het antwoord gaat: een telefoonnummer, of een BSUID als het nummer ontbreekt. */
export type Recipient = { to: string } | { recipient: string };

/** Een fout van de WhatsApp Cloud API: alleen de statuscode en de foutcode van Meta. */
export class WhatsAppError extends Error {
  readonly status: number;
  readonly code: number | undefined;

  constructor(status: number, code?: number) {
    super(`WhatsApp gaf fout ${status}${code !== undefined ? ` (code ${code})` : ""}`);
    this.name = "WhatsAppError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Bepaalt naar wie het antwoord moet. Bij gebruikers met een WhatsApp-gebruikersnaam
 * stuurt Meta soms geen telefoonnummer mee, alleen een BSUID: dan antwoorden we via
 * het veld `recipient`.
 */
export function replyTarget(message: IncomingMessage): Recipient | null {
  if (message.from) return { to: message.from };
  if (message.fromUserId) return { recipient: message.fromUserId };
  return null;
}

/** Stuurt één tekstbericht via de WhatsApp Cloud API. */
export async function sendText(env: Env, recipient: Recipient, body: string): Promise<void> {
  await postMessage(
    env,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      ...recipient,
      type: "text",
      text: { preview_url: false, body },
    },
    6_000,
  );
}

/**
 * Zet het bericht op 'gelezen' en laat 'aan het typen…' zien terwijl de AI zoekt.
 * Dat is geen apart bericht. Lukt het niet, dan gaat de check gewoon door.
 */
export async function showTypingIndicator(env: Env, messageId: string): Promise<void> {
  try {
    await postMessage(
      env,
      {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
        typing_indicator: { type: "text" },
      },
      3_000,
    );
  } catch (error) {
    log("typing_indicator_failed", describeWhatsAppError(error), "warn");
  }
}

async function postMessage(env: Env, payload: Record<string, unknown>, timeoutMs: number): Promise<void> {
  const url =
    `https://graph.facebook.com/${encodeURIComponent(graphApiVersion(env))}` +
    `/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return;
  }
  let code: number | undefined;
  try {
    const data: unknown = await response.json();
    const error = typeof data === "object" && data !== null ? (data as { error?: { code?: unknown } }).error : undefined;
    if (typeof error?.code === "number") code = error.code;
  } catch {
    // Geen leesbare foutmelding; de statuscode is genoeg.
  }
  throw new WhatsAppError(response.status, code);
}

/** Wat we over een WhatsApp-fout loggen: statuscode, foutcode en een hint. Nooit de foutmelding zelf. */
export function describeWhatsAppError(error: unknown): Record<string, string | number> {
  if (!(error instanceof WhatsAppError)) return { error: errorName(error) };
  const details: Record<string, string | number> = { error: "WhatsAppError", status: error.status };
  if (error.code !== undefined) details.code = error.code;
  const hint = whatsAppHint(error);
  if (hint) details.hint = hint;
  return details;
}

function whatsAppHint(error: WhatsAppError): string | undefined {
  switch (error.code) {
    case 190:
      return "WHATSAPP_TOKEN is ongeldig of verlopen";
    case 10:
    case 200:
      return "de token mist rechten (whatsapp_business_messaging)";
    case 100:
      return "controleer WHATSAPP_PHONE_NUMBER_ID";
    case 131030:
      return "dit nummer staat niet in de lijst met testontvangers (API Setup)";
    case 131047:
      return "het laatste bericht van deze gebruiker is ouder dan 24 uur";
  }
  if (error.status === 401) return "WHATSAPP_TOKEN klopt niet";
  return undefined;
}
