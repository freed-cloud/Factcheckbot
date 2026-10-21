/** Eén binnenkomend WhatsApp-bericht, met alleen wat de bot nodig heeft. */
export interface IncomingMessage {
  /** WhatsApp-bericht-ID (wamid). Nooit loggen: er zit het telefoonnummer in verwerkt. */
  id: string;
  /** Soort bericht: text, image, video, audio, sticker, reaction, ... */
  type: string;
  /** Telefoonnummer van de afzender. Ontbreekt soms bij gebruikers met een WhatsApp-gebruikersnaam. */
  from?: string;
  /** Business-scoped user ID (BSUID) van de afzender; staat er ook als het telefoonnummer ontbreekt. */
  fromUserId?: string;
  /** De tekst, alleen bij tekstberichten. */
  text?: string;
}

export interface ParsedWebhook {
  messages: IncomingMessage[];
  /** Aantal statusmeldingen (sent, delivered, read, failed): die negeren we. */
  statuses: number;
  /** Aantal berichten voor een ander WhatsApp-nummer dan dat van de bot. */
  otherNumber: number;
}

/**
 * Haalt de berichten uit een webhook van Meta. Statusmeldingen en berichten voor
 * een ander nummer worden alleen geteld, niet teruggegeven.
 */
export function parseWebhook(payload: unknown, phoneNumberId: string): ParsedWebhook {
  const result: ParsedWebhook = { messages: [], statuses: 0, otherNumber: 0 };
  if (!isRecord(payload) || payload.object !== "whatsapp_business_account") return result;

  for (const entry of asArray(payload.entry)) {
    if (!isRecord(entry)) continue;
    for (const change of asArray(entry.changes)) {
      if (!isRecord(change) || change.field !== "messages" || !isRecord(change.value)) continue;
      const value = change.value;

      result.statuses += asArray(value.statuses).length;

      const messages = asArray(value.messages);
      if (messages.length === 0) continue;

      const metadata = isRecord(value.metadata) ? value.metadata : {};
      if (asString(metadata.phone_number_id) !== phoneNumberId) {
        result.otherNumber += messages.length;
        continue;
      }

      for (const raw of messages) {
        const message = toIncomingMessage(raw);
        if (message) result.messages.push(message);
      }
    }
  }
  return result;
}

function toIncomingMessage(raw: unknown): IncomingMessage | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const type = asString(raw.type);
  if (!id || !type) return null;

  const message: IncomingMessage = { id, type };
  const from = asString(raw.from);
  const fromUserId = asString(raw.from_user_id);
  if (from) message.from = from;
  if (fromUserId) message.fromUserId = fromUserId;
  if (type === "text" && isRecord(raw.text)) {
    const body = asString(raw.text.body);
    if (body) message.text = body;
  }
  return message;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
