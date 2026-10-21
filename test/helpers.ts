import { vi } from "vitest";
import type { Env } from "../src/env";
import { PERPLEXITY_URL } from "../src/perplexity";
import { SeenMessages } from "../src/seen-messages";

// Nepwaarden: er gaat in de tests niets naar internet.
export const PHONE_NUMBER_ID = "106540352242922";
export const APP_SECRET = "test-app-secret";
export const VERIFY_TOKEN = "een lange zelfbedachte zin voor meta";
export const USER_PHONE = "31612345678";
export const USER_BSUID = "NL.13491208655302741918";
export const MESSAGE_ID = "wamid.HBgLMzE2MTIzNDU2NzgVAgASGBQzQTk0RkE3QkQ5MDFDQjA1NjIA";
export const WORKER_URL = "https://factcheckbot.voorbeeld.workers.dev";

export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    WHATSAPP_TOKEN: "test-whatsapp-token",
    WHATSAPP_PHONE_NUMBER_ID: PHONE_NUMBER_ID,
    WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN,
    META_APP_SECRET: APP_SECRET,
    PERPLEXITY_API_KEY: "test-perplexity-key",
    PERPLEXITY_PRESET: "low",
    GRAPH_API_VERSION: "v26.0",
    SEEN_MESSAGES: fakeSeenMessagesNamespace(),
    ...overrides,
  };
}

/** Nagebootste opslag van een Durable Object, in het geheugen. */
export class FakeStorage {
  readonly data = new Map<string, unknown>();
  alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }

  async list<T>(): Promise<Map<string, T>> {
    return new Map([...this.data.entries()].sort(([a], [b]) => a.localeCompare(b))) as Map<string, T>;
  }

  async delete(keys: string | string[]): Promise<boolean | number> {
    if (typeof keys === "string") return this.data.delete(keys);
    if (keys.length > 128) throw new Error("Cloudflare staat maximaal 128 sleutels per keer toe");
    return keys.filter((key) => this.data.delete(key)).length;
  }

  async getAlarm(): Promise<number | null> {
    return this.alarm;
  }

  async setAlarm(time: number | Date): Promise<void> {
    this.alarm = typeof time === "number" ? time : time.getTime();
  }
}

export function seenMessagesWithStorage(storage = new FakeStorage()): { store: SeenMessages; storage: FakeStorage } {
  const store = new SeenMessages({ storage } as unknown as DurableObjectState, {} as Env);
  return { store, storage };
}

/** Doet zich voor als de Durable Object-koppeling, met de echte SeenMessages-code erachter. */
export function fakeSeenMessagesNamespace(): DurableObjectNamespace<SeenMessages> {
  const { store } = seenMessagesWithStorage();
  return {
    idFromName: (name: string) => ({ name }),
    get: () => ({ firstTime: (key: string) => store.firstTime(key) }),
  } as unknown as DurableObjectNamespace<SeenMessages>;
}

/** Zet een handtekening zoals Meta dat doet: HMAC-SHA256 van de ruwe tekst met het app-secret. */
export async function sign(body: string, secret = APP_SECRET): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `sha256=${Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

// ---------------------------------------------------------------------------
// Nepberichten van Meta
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

export function textMessage(body: string, overrides: Json = {}): Json {
  return {
    from: USER_PHONE,
    from_user_id: USER_BSUID,
    id: MESSAGE_ID,
    timestamp: "1792540800",
    type: "text",
    text: { body },
    ...overrides,
  };
}

export function mediaMessage(type: string, overrides: Json = {}): Json {
  return {
    from: USER_PHONE,
    from_user_id: USER_BSUID,
    id: `${MESSAGE_ID}-${type}`,
    timestamp: "1792540800",
    type,
    [type]: { id: "MEDIA_ID", mime_type: "application/octet-stream" },
    ...overrides,
  };
}

export function messagesPayload(messages: Json[], phoneNumberId = PHONE_NUMBER_ID): Json {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550783881", phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: "Test Gebruiker" }, wa_id: USER_PHONE, user_id: USER_BSUID }],
              messages,
            },
          },
        ],
      },
    ],
  };
}

export function statusesPayload(): Json {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550783881", phone_number_id: PHONE_NUMBER_ID },
              statuses: [
                { id: "wamid.UIT1", status: "sent", timestamp: "1792540801", recipient_id: USER_PHONE },
                { id: "wamid.UIT1", status: "delivered", timestamp: "1792540802", recipient_user_id: USER_BSUID },
                { id: "wamid.UIT1", status: "read", timestamp: "1792540803", recipient_id: USER_PHONE },
              ],
            },
          },
        ],
      },
    ],
  };
}

export async function webhookRequest(
  payload: unknown,
  options: { signature?: string | null; secret?: string } = {},
): Promise<Request> {
  const body = JSON.stringify(payload);
  const headers = new Headers({ "Content-Type": "application/json" });
  const signature = options.signature === undefined ? await sign(body, options.secret) : options.signature;
  if (signature !== null) headers.set("X-Hub-Signature-256", signature);
  return new Request(`${WORKER_URL}/webhook`, { method: "POST", headers, body });
}

/** Nagebootste ExecutionContext: verzamelt het werk dat in ctx.waitUntil wordt gezet. */
export function fakeContext(): { ctx: ExecutionContext; tasks: Promise<unknown>[]; settle: () => Promise<unknown[]> } {
  const tasks: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => {
      tasks.push(promise);
    },
    passThroughOnException: () => undefined,
    props: {},
  } as unknown as ExecutionContext;
  return { ctx, tasks, settle: () => Promise.all(tasks) };
}

// ---------------------------------------------------------------------------
// Nepantwoorden van Perplexity
// ---------------------------------------------------------------------------

export const SEARCH_RESULTS = [
  {
    id: 1,
    url: "https://www.rivm.nl/5g-en-gezondheid?utm_source=perplexity&utm_medium=api",
    title: "5G en gezondheid | RIVM",
    snippet: "Er is geen bewijs dat 5G schadelijk is voor de gezondheid.",
    date: null,
    last_updated: "2026-03-01",
    source: "web",
  },
  {
    id: 2,
    url: "https://nieuwscheckers.nl/5g-veroorzaakt-geen-corona/",
    title: "5G veroorzaakt geen corona | Nieuwscheckers",
    snippet: "Virussen verspreiden zich niet via radiogolven.",
    date: "2020-04-10",
    last_updated: "2025-11-12",
    source: "web",
  },
  {
    id: 3,
    url: "https://nos.nl/artikel/2331234-5g-masten",
    title: "Brandstichting bij 5G-masten | NOS",
    snippet: "Complottheorieën over 5G.",
    date: "2020-04-12",
    last_updated: "2020-04-12",
    source: "web",
  },
  {
    id: 4,
    url: "https://voorbeeld-blog.example/5g",
    title: "Blog",
    snippet: "Een blog.",
    date: null,
    last_updated: null,
    source: "web",
  },
];

export const FALSE_CLAIM_ANSWER =
  "OORDEEL: Klopt niet\n" +
  "UITLEG: Er is geen wetenschappelijk bewijs dat 5G corona veroorzaakt of verspreidt [web:2]. " +
  "Virussen verspreiden zich via mensen, niet via radiogolven [web:1].";

export function agentResponse(
  text: string,
  results: unknown[] = SEARCH_RESULTS,
  options: { withOutputText?: boolean } = {},
): Json {
  const output = [
    { type: "search_results", queries: ["5G corona feiten"], results },
    {
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text, annotations: [], logprobs: [] }],
    },
  ];
  const response: Json = { id: "resp_test", object: "response", status: "completed", model: "test", output };
  if (options.withOutputText ?? true) response.output_text = text;
  return response;
}

// ---------------------------------------------------------------------------
// Nagebootst internet
// ---------------------------------------------------------------------------

export interface RecordedCall {
  url: string;
  body: Json;
  headers: Headers;
}

export interface FakeInternet {
  whatsapp: RecordedCall[];
  perplexity: RecordedCall[];
  /** De teksten die de bot via WhatsApp heeft verstuurd. */
  sentTexts: () => string[];
  /** De berichten die de bot via WhatsApp heeft verstuurd (alle velden). */
  sentMessages: () => Json[];
}

export type PerplexityHandler = (body: Json, init: RequestInit) => Response | Promise<Response>;

/** Vervangt fetch: WhatsApp en Perplexity worden nagebootst, de rest geeft een fout. */
export function fakeInternet(
  perplexity: PerplexityHandler = () => Response.json(agentResponse(FALSE_CLAIM_ANSWER)),
  whatsapp: (body: Json) => Response | Promise<Response> = () =>
    Response.json({ messaging_product: "whatsapp", messages: [{ id: "wamid.ANTWOORD" }] }),
): FakeInternet {
  const internet: FakeInternet = {
    whatsapp: [],
    perplexity: [],
    sentMessages: () => internet.whatsapp.map((call) => call.body).filter((body) => body.type === "text"),
    sentTexts: () => internet.sentMessages().map((body) => (body.text as { body: string }).body),
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const body = (init.body ? JSON.parse(String(init.body)) : {}) as Json;
      const call: RecordedCall = { url, body, headers: new Headers(init.headers) };
      if (url.startsWith("https://graph.facebook.com/")) {
        internet.whatsapp.push(call);
        return whatsapp(body);
      }
      if (url === PERPLEXITY_URL) {
        internet.perplexity.push(call);
        return perplexity(body, init);
      }
      throw new Error(`Onverwachte netwerkaanroep naar ${url}`);
    }),
  );
  return internet;
}

/** Vangt alle logregels op (en houdt de testuitvoer stil). */
export function captureLogs(): () => string[] {
  const lines: string[] = [];
  const record = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  vi.spyOn(console, "log").mockImplementation(record);
  vi.spyOn(console, "warn").mockImplementation(record);
  vi.spyOn(console, "error").mockImplementation(record);
  return () => lines;
}

export function logEvents(lines: string[]): Json[] {
  return lines.map((line) => JSON.parse(line) as Json);
}
