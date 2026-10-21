import { describe, expect, it } from "vitest";
import { parseWebhook } from "../src/webhook";
import {
  MESSAGE_ID,
  mediaMessage,
  messagesPayload,
  PHONE_NUMBER_ID,
  statusesPayload,
  textMessage,
  USER_BSUID,
  USER_PHONE,
} from "./helpers";

describe("webhook van Meta uitlezen", () => {
  it("haalt een tekstbericht eruit", () => {
    const parsed = parseWebhook(messagesPayload([textMessage("Klopt dit?")]), PHONE_NUMBER_ID);
    expect(parsed).toEqual({
      messages: [{ id: MESSAGE_ID, type: "text", from: USER_PHONE, fromUserId: USER_BSUID, text: "Klopt dit?" }],
      statuses: 0,
      otherNumber: 0,
    });
  });

  it("telt statusmeldingen, maar geeft ze niet terug", () => {
    expect(parseWebhook(statusesPayload(), PHONE_NUMBER_ID)).toEqual({ messages: [], statuses: 3, otherNumber: 0 });
  });

  it("werkt zonder telefoonnummer (alleen een BSUID)", () => {
    const parsed = parseWebhook(messagesPayload([textMessage("Klopt dit?", { from: undefined })]), PHONE_NUMBER_ID);
    expect(parsed.messages[0]).toEqual({ id: MESSAGE_ID, type: "text", fromUserId: USER_BSUID, text: "Klopt dit?" });
  });

  it("geeft bij foto's geen tekst mee", () => {
    const parsed = parseWebhook(messagesPayload([mediaMessage("image")]), PHONE_NUMBER_ID);
    expect(parsed.messages[0]).toMatchObject({ type: "image" });
    expect(parsed.messages[0]).not.toHaveProperty("text");
  });

  it("slaat berichten voor een ander nummer over", () => {
    expect(parseWebhook(messagesPayload([textMessage("Hoi")]), "ander-nummer")).toEqual({
      messages: [],
      statuses: 0,
      otherNumber: 1,
    });
  });

  it.each([null, "tekst", [], {}, { object: "page", entry: [] }, { object: "whatsapp_business_account", entry: "x" }])(
    "geeft niets terug bij rare invoer: %j",
    (payload) => {
      expect(parseWebhook(payload, PHONE_NUMBER_ID)).toEqual({ messages: [], statuses: 0, otherNumber: 0 });
    },
  );

  it("slaat berichten zonder ID of soort over", () => {
    const parsed = parseWebhook(
      messagesPayload([{ type: "text", text: { body: "zonder id" } }, { id: "wamid.X", text: { body: "zonder soort" } }]),
      PHONE_NUMBER_ID,
    );
    expect(parsed.messages).toEqual([]);
  });
});
