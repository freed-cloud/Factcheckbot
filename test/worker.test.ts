import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";
import { PERPLEXITY_URL } from "../src/perplexity";
import { CLOSING_LINE, HOW_IT_WORKS, MAX_REPLY_LENGTH, ONLY_TEXT } from "../src/reply";
import {
  agentResponse,
  captureLogs,
  fakeContext,
  fakeInternet,
  logEvents,
  MESSAGE_ID,
  mediaMessage,
  messagesPayload,
  PHONE_NUMBER_ID,
  sign,
  statusesPayload,
  testEnv,
  textMessage,
  USER_BSUID,
  USER_PHONE,
  VERIFY_TOKEN,
  webhookRequest,
  WORKER_URL,
} from "./helpers";

const CLAIM = "Doorsturen!! 5G-masten verspreiden het coronavirus, zegt mijn buurman.";

/** Roept de Worker aan zoals Cloudflare dat doet. */
function callWorker(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  return worker.fetch(request as Parameters<typeof worker.fetch>[0], env, ctx);
}

let logs: () => string[];

beforeEach(() => {
  logs = captureLogs();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Stuurt een webhook naar de Worker en wacht tot het werk op de achtergrond klaar is. */
async function deliver(payload: unknown, env = testEnv()) {
  const { ctx, settle, tasks } = fakeContext();
  const response = await callWorker(await webhookRequest(payload), env, ctx);
  await settle();
  return { response, tasks };
}

describe("GET /webhook (verificatie door Meta)", () => {
  it("geeft hub.challenge terug als de verify token klopt", async () => {
    const url = new URL(`${WORKER_URL}/webhook`);
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", VERIFY_TOKEN);
    url.searchParams.set("hub.challenge", "1158201444");
    const response = await callWorker(new Request(url), testEnv(), fakeContext().ctx);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("1158201444");
  });

  it("weigert een verkeerde verify token", async () => {
    const url = new URL(`${WORKER_URL}/webhook`);
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", "verkeerd");
    url.searchParams.set("hub.challenge", "1158201444");
    const response = await callWorker(new Request(url), testEnv(), fakeContext().ctx);
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("1158201444");
  });
});

describe("beginpagina", () => {
  it("laat zien welke geheimen nog ontbreken en wat het webhookadres is", async () => {
    const env = testEnv({ META_APP_SECRET: "", PERPLEXITY_API_KEY: "" });
    const response = await callWorker(new Request(`${WORKER_URL}/`), env, fakeContext().ctx);
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain("Nog niet ingesteld: META_APP_SECRET, PERPLEXITY_API_KEY.");
    expect(text).toContain(`Webhookadres voor Meta: ${WORKER_URL}/webhook`);
    expect(text).not.toContain("test-whatsapp-token");
  });

  it("meldt dat alles is ingesteld", async () => {
    const response = await callWorker(new Request(`${WORKER_URL}/`), testEnv(), fakeContext().ctx);
    expect(await response.text()).toContain("Alle 5 geheimen zijn ingesteld.");
  });
});

describe("POST /webhook: handtekening", () => {
  it("weigert een bericht zonder handtekening", async () => {
    const internet = fakeInternet();
    const { ctx, tasks } = fakeContext();
    const request = await webhookRequest(messagesPayload([textMessage(CLAIM)]), { signature: null });
    const response = await callWorker(request, testEnv(), ctx);
    expect(response.status).toBe(401);
    expect(tasks).toHaveLength(0);
    expect(internet.whatsapp).toHaveLength(0);
  });

  it("weigert een bericht dat met een ander geheim is ondertekend", async () => {
    const internet = fakeInternet();
    const { ctx, tasks } = fakeContext();
    const request = await webhookRequest(messagesPayload([textMessage(CLAIM)]), { secret: "ander-geheim" });
    const response = await callWorker(request, testEnv(), ctx);
    expect(response.status).toBe(401);
    expect(tasks).toHaveLength(0);
    expect(internet.perplexity).toHaveLength(0);
  });

  it("weigert een bericht dat na het ondertekenen is aangepast", async () => {
    fakeInternet();
    const original = JSON.stringify(messagesPayload([textMessage(CLAIM)]));
    const tampered = original.replace("5G-masten", "6G-masten");
    const request = new Request(`${WORKER_URL}/webhook`, {
      method: "POST",
      headers: { "X-Hub-Signature-256": await sign(original) },
      body: tampered,
    });
    const response = await callWorker(request, testEnv(), fakeContext().ctx);
    expect(response.status).toBe(401);
  });

  it("geeft een fout zolang de geheimen niet zijn ingesteld", async () => {
    fakeInternet();
    const env = testEnv({ META_APP_SECRET: "" });
    const response = await callWorker(await webhookRequest(messagesPayload([textMessage(CLAIM)])), env, fakeContext().ctx);
    expect(response.status).toBe(500);
    expect(logEvents(logs())).toContainEqual(expect.objectContaining({ event: "missing_secrets", names: "META_APP_SECRET" }));
  });
});

describe("POST /webhook: berichten", () => {
  it("negeert statusmeldingen (sent, delivered, read)", async () => {
    const internet = fakeInternet();
    const { response, tasks } = await deliver(statusesPayload());
    expect(response.status).toBe(200);
    expect(tasks).toHaveLength(0);
    expect(internet.whatsapp).toHaveLength(0);
    expect(internet.perplexity).toHaveLength(0);
  });

  it("checkt een bewering en stuurt één antwoord terug", async () => {
    const internet = fakeInternet();
    const { response } = await deliver(messagesPayload([textMessage(CLAIM)]));

    expect(response.status).toBe(200);

    // De AI krijgt de juiste opdracht.
    expect(internet.perplexity).toHaveLength(1);
    const aiCall = internet.perplexity[0]!;
    expect(aiCall.url).toBe(PERPLEXITY_URL);
    expect(aiCall.headers.get("Authorization")).toBe("Bearer test-perplexity-key");
    expect(aiCall.body.preset).toBe("low");
    expect(aiCall.body.instructions).toEqual(expect.stringContaining("Verzin nooit bronnen"));
    expect(aiCall.body.input).toEqual(expect.stringContaining(CLAIM));

    // Eerst 'aan het typen…', daarna precies één antwoord.
    const [typing, answer] = internet.whatsapp;
    expect(internet.whatsapp).toHaveLength(2);
    expect(typing!.body).toEqual({
      messaging_product: "whatsapp",
      status: "read",
      message_id: MESSAGE_ID,
      typing_indicator: { type: "text" },
    });
    expect(answer!.url).toBe(`https://graph.facebook.com/v26.0/${PHONE_NUMBER_ID}/messages`);
    expect(answer!.headers.get("Authorization")).toBe("Bearer test-whatsapp-token");
    expect(answer!.body).toMatchObject({ messaging_product: "whatsapp", to: USER_PHONE, type: "text" });

    const text = internet.sentTexts()[0]!;
    expect(text).toContain("*Oordeel:* ❌ Klopt niet");
    expect(text).toContain("*Uitleg:* Er is geen wetenschappelijk bewijs");
    expect(text).toContain("1. https://nieuwscheckers.nl/5g-veroorzaakt-geen-corona/");
    expect(text).toContain("2. https://www.rivm.nl/5g-en-gezondheid");
    expect(text).not.toContain("utm_source");
    expect(text).not.toContain("[web:");
    expect(text.endsWith(`_${CLOSING_LINE}_`)).toBe(true);
    expect(text.length).toBeLessThanOrEqual(MAX_REPLY_LENGTH);
  });

  it("antwoordt Meta meteen, ook als de AI nog bezig is", async () => {
    let finishAi: (response: Response) => void = () => undefined;
    const internet = fakeInternet(() => new Promise<Response>((resolve) => (finishAi = resolve)));
    const { ctx, settle } = fakeContext();

    const response = await callWorker(await webhookRequest(messagesPayload([textMessage(CLAIM)])), testEnv(), ctx);
    expect(response.status).toBe(200);
    expect(internet.sentTexts()).toHaveLength(0);

    await vi.waitFor(() => expect(internet.perplexity).toHaveLength(1));
    finishAi(Response.json(agentResponse("OORDEEL: Klopt niet\nUITLEG: Dit klopt niet [web:1].")));
    await settle();
    expect(internet.sentTexts()).toHaveLength(1);
  });

  it("antwoordt maar één keer als Meta hetzelfde bericht opnieuw stuurt", async () => {
    const internet = fakeInternet();
    const env = testEnv();
    const payload = messagesPayload([textMessage(CLAIM)]);
    await deliver(payload, env);
    await deliver(payload, env);
    expect(internet.perplexity).toHaveLength(1);
    expect(internet.sentTexts()).toHaveLength(1);
    expect(logEvents(logs())).toContainEqual(expect.objectContaining({ event: "duplicate_ignored" }));
  });

  it("antwoordt via de BSUID als Meta geen telefoonnummer meestuurt", async () => {
    const internet = fakeInternet();
    await deliver(messagesPayload([textMessage(CLAIM, { from: undefined })]));
    const [sent] = internet.sentMessages();
    expect(sent).toMatchObject({ recipient: USER_BSUID, type: "text" });
    expect(sent).not.toHaveProperty("to");
  });

  it.each(["image", "video", "audio", "sticker", "document"])(
    "zegt bij een %s-bericht dat de bot alleen tekst checkt",
    async (type) => {
      const internet = fakeInternet();
      await deliver(messagesPayload([mediaMessage(type)]));
      expect(internet.perplexity).toHaveLength(0);
      expect(internet.sentTexts()).toEqual([ONLY_TEXT]);
    },
  );

  it("reageert niet op een reactie-emoji", async () => {
    const internet = fakeInternet();
    await deliver(
      messagesPayload([mediaMessage("reaction", { reaction: { message_id: "wamid.ANTWOORD", emoji: "👍" } })]),
    );
    expect(internet.whatsapp).toHaveLength(0);
  });

  it("legt bij een groet uit hoe de bot werkt, zonder de AI te vragen", async () => {
    const internet = fakeInternet();
    await deliver(messagesPayload([textMessage("Hoi! 👋")]));
    expect(internet.perplexity).toHaveLength(0);
    expect(internet.sentTexts()).toEqual([HOW_IT_WORKS]);
  });

  it("legt uit hoe de bot werkt als de AI geen bewering vindt", async () => {
    const internet = fakeInternet(() =>
      Response.json(agentResponse("OORDEEL: Geen bewering\nUITLEG: Dit is een persoonlijke mening.")),
    );
    await deliver(messagesPayload([textMessage("Ik vind spruitjes echt heel vies om te eten eigenlijk")]));
    expect(internet.perplexity).toHaveLength(1);
    expect(internet.sentTexts()).toEqual([HOW_IT_WORKS]);
  });

  it("gebruikt de ingestelde preset", async () => {
    const internet = fakeInternet();
    await deliver(messagesPayload([textMessage(CLAIM)]), testEnv({ PERPLEXITY_PRESET: "fast" }));
    expect(internet.perplexity[0]!.body.preset).toBe("fast");
  });

  it("negeert berichten voor een ander WhatsApp-nummer", async () => {
    const internet = fakeInternet();
    const { tasks } = await deliver(messagesPayload([textMessage(CLAIM)], "999999999999999"));
    expect(tasks).toHaveLength(0);
    expect(internet.whatsapp).toHaveLength(0);
  });

  it("verwerkt meerdere berichten in één webhook", async () => {
    const internet = fakeInternet();
    await deliver(
      messagesPayload([textMessage(CLAIM), textMessage("Hallo", { id: `${MESSAGE_ID}-2` }), mediaMessage("image")]),
    );
    expect(internet.perplexity).toHaveLength(1);
    expect(internet.sentTexts()).toHaveLength(3);
  });
});

describe("privacy", () => {
  it("zet geen berichttekst, telefoonnummer, BSUID of bericht-ID in de logs", async () => {
    fakeInternet();
    await deliver(messagesPayload([textMessage(CLAIM)]));
    await deliver(messagesPayload([textMessage(CLAIM, { id: `${MESSAGE_ID}-2`, from: undefined })]));
    await deliver(statusesPayload());

    const output = logs().join("\n");
    expect(output.length).toBeGreaterThan(0);
    for (const secret of ["5G-masten", "buurman", USER_PHONE, USER_BSUID, MESSAGE_ID, "Klopt niet", "rivm.nl"]) {
      expect(output).not.toContain(secret);
    }
    // Alle logregels zijn nette JSON met een gebeurtenis.
    for (const event of logEvents(logs())) expect(typeof event.event).toBe("string");
  });
});
