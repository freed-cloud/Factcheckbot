import { afterEach, describe, expect, it, vi } from "vitest";
import { isFirstDelivery, sha256Hex } from "../src/dedup";
import { CLEANUP_EVERY_MS, KEEP_FOR_MS } from "../src/seen-messages";
import { captureLogs, MESSAGE_ID, seenMessagesWithStorage, testEnv } from "./helpers";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("opslag voor dubbele berichten", () => {
  it("zegt de eerste keer ja en daarna nee", async () => {
    const { store } = seenMessagesWithStorage();
    expect(await store.firstTime("code-1")).toBe(true);
    expect(await store.firstTime("code-1")).toBe(false);
    expect(await store.firstTime("code-2")).toBe(true);
  });

  it("plant een opruimbeurt in", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-21T12:00:00Z") });
    const { store, storage } = seenMessagesWithStorage();
    await store.firstTime("code-1");
    expect(storage.alarm).toBe(Date.now() + CLEANUP_EVERY_MS);
  });

  it("ruimt codes op die ouder zijn dan twee dagen", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-18T12:00:00Z") });
    const { store, storage } = seenMessagesWithStorage();
    for (let i = 0; i < 300; i++) await store.firstTime(`oud-${i}`);

    vi.setSystemTime(Date.now() + KEEP_FOR_MS + 1000);
    await store.firstTime("nieuw");
    storage.alarm = null;
    await store.alarm();

    expect([...storage.data.keys()]).toEqual(["nieuw"]);
    expect(storage.alarm).not.toBeNull();
    expect(await store.firstTime("oud-1")).toBe(true);
  });

  it("plant geen opruimbeurt meer als alles leeg is", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-18T12:00:00Z") });
    const { store, storage } = seenMessagesWithStorage();
    await store.firstTime("oud");
    vi.setSystemTime(Date.now() + KEEP_FOR_MS + 1000);
    storage.alarm = null;
    await store.alarm();
    expect(storage.data.size).toBe(0);
    expect(storage.alarm).toBeNull();
  });
});

describe("isFirstDelivery", () => {
  it("bewaart alleen een onherkenbare code, niet het bericht-ID", async () => {
    const stored: string[] = [];
    const env = testEnv({
      SEEN_MESSAGES: {
        idFromName: () => ({}),
        get: () => ({
          firstTime: async (key: string) => {
            stored.push(key);
            return true;
          },
        }),
      } as unknown as ReturnType<typeof testEnv>["SEEN_MESSAGES"],
    });
    expect(await isFirstDelivery(env, MESSAGE_ID)).toBe(true);
    expect(stored).toEqual([await sha256Hex(MESSAGE_ID)]);
    expect(stored[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("laat het bericht door als de opslag even niet werkt", async () => {
    captureLogs();
    const env = testEnv({
      SEEN_MESSAGES: {
        idFromName: () => ({}),
        get: () => ({
          firstTime: async () => {
            throw new Error("storing");
          },
        }),
      } as unknown as ReturnType<typeof testEnv>["SEEN_MESSAGES"],
    });
    expect(await isFirstDelivery(env, MESSAGE_ID)).toBe(true);
  });
});
