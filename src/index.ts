import { handleMessage } from "./bot";
import { type Env, graphApiVersion, missingSecrets, perplexityPreset, REQUIRED_SECRETS } from "./env";
import { errorName, log } from "./log";
import { isValidSignature, safeEqual } from "./signature";
import { parseWebhook } from "./webhook";

// De opslag voor dubbele berichten moet vanuit dit bestand bereikbaar zijn voor Cloudflare.
export { SeenMessages } from "./seen-messages";

/** Webhooks van Meta zijn klein; grotere verzoeken weigeren we meteen. */
const MAX_BODY_BYTES = 1_000_000;

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/webhook") {
      if (request.method === "GET") return verifySubscription(url, env);
      if (request.method === "POST") return receiveWebhook(request, env, ctx);
      return plain("Methode niet toegestaan", 405, { Allow: "GET, POST" });
    }

    if (url.pathname === "/" && request.method === "GET") return statusPage(url, env);

    return plain("Niet gevonden", 404);
  },
} satisfies ExportedHandler<Env>;

/**
 * GET /webhook: Meta controleert eenmalig of het webhookadres van jou is.
 * Klopt de verify token, dan geven we hub.challenge terug.
 */
function verifySubscription(url: URL, env: Env): Response {
  if (!env.WHATSAPP_VERIFY_TOKEN) {
    log("missing_secrets", { names: "WHATSAPP_VERIFY_TOKEN" }, "error");
    return plain("WHATSAPP_VERIFY_TOKEN is nog niet ingesteld", 500);
  }
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token !== null && challenge !== null && safeEqual(token, env.WHATSAPP_VERIFY_TOKEN)) {
    log("webhook_verified");
    return plain(challenge, 200);
  }
  log("webhook_verification_failed", { hint: "verify token in Meta en bij Cloudflare moeten gelijk zijn" }, "warn");
  return plain("Verificatie mislukt", 403);
}

/**
 * POST /webhook: een nieuw bericht of een statusmelding van Meta.
 * We controleren de handtekening, antwoorden Meta meteen met 200 en doen de
 * check daarna op de achtergrond (ctx.waitUntil).
 */
async function receiveWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const missing = missingSecrets(env);
  if (missing.length > 0) {
    log("missing_secrets", { names: missing.join(",") }, "error");
    return plain("De bot is nog niet volledig ingesteld", 500);
  }

  const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) return plain("Te groot", 413);

  const rawBody = await request.arrayBuffer();
  if (rawBody.byteLength > MAX_BODY_BYTES) return plain("Te groot", 413);

  const signatureOk = await isValidSignature(rawBody, request.headers.get("X-Hub-Signature-256"), env.META_APP_SECRET);
  if (!signatureOk) {
    log("invalid_signature", { hint: "controleer META_APP_SECRET" }, "warn");
    return plain("Ongeldige handtekening", 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    log("invalid_json", {}, "warn");
    return plain("Ongeldige JSON", 400);
  }

  const { messages, statuses, otherNumber } = parseWebhook(payload, env.WHATSAPP_PHONE_NUMBER_ID);
  if (statuses > 0) log("statuses_ignored", { count: statuses });
  if (otherNumber > 0) {
    log("other_number_ignored", { count: otherNumber, hint: "controleer WHATSAPP_PHONE_NUMBER_ID" }, "warn");
  }

  for (const message of messages) {
    ctx.waitUntil(
      handleMessage(message, env).catch((error: unknown) => {
        log("unexpected_error", { error: errorName(error) }, "error");
      }),
    );
  }

  return plain("OK", 200);
}

/** De beginpagina van de Worker: laat zien of alles is ingesteld en wat het webhookadres is. */
function statusPage(url: URL, env: Env): Response {
  const missing = missingSecrets(env);
  const lines = [
    "Factcheckbot draait.",
    "",
    missing.length === 0
      ? `Alle ${REQUIRED_SECRETS.length} geheimen zijn ingesteld.`
      : `Nog niet ingesteld: ${missing.join(", ")}.`,
    `Webhookadres voor Meta: ${url.origin}/webhook`,
    `AI-preset: ${perplexityPreset(env)}`,
    `Graph API-versie: ${graphApiVersion(env)}`,
  ];
  return plain(lines.join("\n"), 200);
}

function plain(body: string, status: number, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
  });
}
