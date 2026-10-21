import { isFirstDelivery } from "./dedup";
import type { Env } from "./env";
import { isGreetingOrHelp } from "./greeting";
import { errorName, log, type LogDetails } from "./log";
import { AiError, AiTimeoutError, aiErrorHint, checkClaim } from "./perplexity";
import { ERROR_REPLY, formatCheckReply, HOW_IT_WORKS, ONLY_TEXT, TIMEOUT_REPLY } from "./reply";
import type { IncomingMessage } from "./webhook";
import { describeWhatsAppError, type Recipient, replyTarget, sendText, showTypingIndicator } from "./whatsapp";

/**
 * De AI-check stopt na 20 seconden. Cloudflare geeft de bot in totaal 30 seconden na het
 * antwoord aan Meta; zo blijft er tijd over om het antwoord te versturen (hooguit 6 seconden).
 */
export const AI_TIMEOUT_MS = 20_000;

/** Berichten zonder tekst: daarop zegt de bot dat hij alleen tekst kan checken. */
const NON_TEXT_TYPES = new Set([
  "image",
  "video",
  "audio", // ook spraakberichten
  "document",
  "sticker",
  "location",
  "contacts",
  "unsupported", // bijvoorbeeld een peiling of een foto die je maar één keer kunt bekijken
]);

export interface BotOptions {
  /** Alleen voor tests: een kortere time-out. */
  aiTimeoutMs?: number;
  /** Alleen voor tests: een vaste datum. */
  now?: () => Date;
}

/**
 * Handelt één binnenkomend bericht af en stuurt precies één antwoord terug
 * (of niets, bij een reactie-emoji of een dubbel bezorgd bericht).
 */
export async function handleMessage(message: IncomingMessage, env: Env, options: BotOptions = {}): Promise<void> {
  const recipient = replyTarget(message);
  if (!recipient) {
    log("message_without_sender", { type: message.type }, "warn");
    return;
  }

  if (!(await isFirstDelivery(env, message.id))) {
    log("duplicate_ignored", { type: message.type });
    return;
  }

  if (message.type === "request_welcome") {
    await reply(env, recipient, HOW_IT_WORKS, "welcome");
    return;
  }
  if (NON_TEXT_TYPES.has(message.type)) {
    await reply(env, recipient, ONLY_TEXT, "only_text");
    return;
  }
  if (message.type !== "text") {
    // Bijvoorbeeld een reactie-emoji op een eerder antwoord: daar reageren we niet op.
    log("message_type_ignored", { type: message.type });
    return;
  }

  const text = message.text?.trim() ?? "";
  if (!text || isGreetingOrHelp(text)) {
    await reply(env, recipient, HOW_IT_WORKS, "how_it_works");
    return;
  }

  // 'Aan het typen…' loopt tegelijk met de AI-check, zodat de 30 seconden van Cloudflare ruim genoeg zijn.
  const typing = showTypingIndicator(env, message.id);

  const started = Date.now();
  let answer: string;
  let kind: string;
  try {
    const result = await checkClaim(text, env, {
      timeoutMs: options.aiTimeoutMs ?? AI_TIMEOUT_MS,
      today: options.now?.() ?? new Date(),
    });
    log("check_done", { verdict: result.verdict, sources: result.sources.length, ms: Date.now() - started });
    if (result.verdict === "no_claim") {
      answer = HOW_IT_WORKS;
      kind = "no_claim";
    } else {
      answer = formatCheckReply(result);
      kind = "check";
    }
  } catch (error) {
    if (error instanceof AiTimeoutError) {
      log("ai_timeout", { ms: Date.now() - started, hint: "zet PERPLEXITY_PRESET op fast" }, "warn");
      answer = TIMEOUT_REPLY;
      kind = "timeout";
    } else {
      log("ai_error", describeAiError(error), "error");
      answer = ERROR_REPLY;
      kind = "ai_error";
    }
  }

  await typing; // zodat 'aan het typen…' nooit pas na het antwoord verschijnt
  await reply(env, recipient, answer, kind);
}

async function reply(env: Env, recipient: Recipient, body: string, kind: string): Promise<void> {
  try {
    await sendText(env, recipient, body);
    log("reply_sent", { kind, length: body.length });
  } catch (error) {
    log("reply_failed", { kind, ...describeWhatsAppError(error) }, "error");
  }
}

function describeAiError(error: unknown): LogDetails {
  if (!(error instanceof AiError)) return { error: errorName(error) };
  const details: LogDetails = { error: "AiError", reason: error.reason };
  const hint = aiErrorHint(error);
  if (hint) details.hint = hint;
  return details;
}
