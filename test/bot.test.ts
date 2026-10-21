import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleMessage } from "../src/bot";
import { ERROR_REPLY, TIMEOUT_REPLY } from "../src/reply";
import {
  agentResponse,
  captureLogs,
  FALSE_CLAIM_ANSWER,
  fakeInternet,
  logEvents,
  MESSAGE_ID,
  testEnv,
  USER_PHONE,
} from "./helpers";

const message = {
  id: MESSAGE_ID,
  type: "text",
  from: USER_PHONE,
  text: "De Tweede Kamer heeft vorige week besloten dat contant geld per 2027 wordt afgeschaft.",
};

let logs: () => string[];

beforeEach(() => {
  logs = captureLogs();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("als de AI-check misgaat", () => {
  it("stopt na de time-out en stuurt een kort excuusbericht", async () => {
    const internet = fakeInternet(
      (_body, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("Afgebroken", "AbortError")));
        }),
    );
    await handleMessage(message, testEnv(), { aiTimeoutMs: 25 });
    expect(internet.sentTexts()).toEqual([TIMEOUT_REPLY]);
    expect(logEvents(logs())).toContainEqual(expect.objectContaining({ event: "ai_timeout" }));
  });

  it("stuurt een excuusbericht en logt een hint bij een verkeerde API-sleutel", async () => {
    const internet = fakeInternet(() => new Response('{"error":{"message":"Invalid API key"}}', { status: 401 }));
    await handleMessage(message, testEnv(), {});
    expect(internet.sentTexts()).toEqual([ERROR_REPLY]);
    expect(logEvents(logs())).toContainEqual(
      expect.objectContaining({ event: "ai_error", reason: "http_401", hint: "PERPLEXITY_API_KEY klopt niet" }),
    );
  });

  it("stuurt een excuusbericht als het antwoord niet de afgesproken vorm heeft", async () => {
    const internet = fakeInternet(() =>
      Response.json({ status: "completed", output_text: "Daar kan ik helaas niets over zeggen." }),
    );
    await handleMessage(message, testEnv(), {});
    expect(internet.sentTexts()).toEqual([ERROR_REPLY]);
  });
});

describe("als WhatsApp een fout geeft", () => {
  it("crasht niet en logt een hint", async () => {
    fakeInternet(undefined, () =>
      Response.json(
        { error: { message: "(#131030) Recipient phone number not in allowed list", code: 131030 } },
        { status: 400 },
      ),
    );
    await expect(handleMessage(message, testEnv(), {})).resolves.toBeUndefined();
    expect(logEvents(logs())).toContainEqual(
      expect.objectContaining({
        event: "reply_failed",
        code: 131030,
        hint: "dit nummer staat niet in de lijst met testontvangers (API Setup)",
      }),
    );
  });

  it("gaat door met de check als 'aan het typen…' niet lukt", async () => {
    let calls = 0;
    const internet = fakeInternet(undefined, () => {
      calls += 1;
      return calls === 1
        ? Response.json({ error: { code: 100 } }, { status: 400 })
        : Response.json({ messages: [{ id: "wamid.ANTWOORD" }] });
    });
    await handleMessage(message, testEnv(), {});
    expect(internet.perplexity).toHaveLength(1);
    expect(internet.sentTexts()).toHaveLength(1);
  });
});

describe("'aan het typen…'", () => {
  it("loopt tegelijk met de AI-check, maar komt altijd vóór het antwoord", async () => {
    const order: string[] = [];
    fakeInternet(
      () => {
        order.push("ai");
        return Response.json(agentResponse(FALSE_CLAIM_ANSWER));
      },
      async (body) => {
        if (body.status === "read") {
          order.push("typing-start");
          await new Promise((resolve) => setTimeout(resolve, 20));
          order.push("typing-done");
        } else {
          order.push("answer");
        }
        return Response.json({ messages: [{ id: "wamid.ANTWOORD" }] });
      },
    );
    await handleMessage(message, testEnv(), {});
    expect(order).toEqual(["typing-start", "ai", "typing-done", "answer"]);
  });
});

describe("zonder opslag voor dubbele berichten", () => {
  it("werkt de bot gewoon", async () => {
    const internet = fakeInternet();
    await handleMessage(message, testEnv({ SEEN_MESSAGES: undefined }), {});
    expect(internet.sentTexts()).toHaveLength(1);
  });
});
