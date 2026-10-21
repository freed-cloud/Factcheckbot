import { describe, expect, it } from "vitest";
import { isValidSignature, safeEqual } from "../src/signature";
import { APP_SECRET, sign } from "./helpers";

const body = '{"object":"whatsapp_business_account","entry":[]}';
const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe("handtekening van Meta", () => {
  it("accepteert een juiste handtekening", async () => {
    expect(await isValidSignature(bytes(body), await sign(body), APP_SECRET)).toBe(true);
  });

  it("accepteert hoofdletters in de handtekening", async () => {
    const signature = `sha256=${(await sign(body)).slice("sha256=".length).toUpperCase()}`;
    expect(await isValidSignature(bytes(body), signature, APP_SECRET)).toBe(true);
  });

  it("weigert een handtekening met een ander geheim", async () => {
    expect(await isValidSignature(bytes(body), await sign(body, "ander-geheim"), APP_SECRET)).toBe(false);
  });

  it("weigert een aangepast bericht", async () => {
    expect(await isValidSignature(bytes(`${body} `), await sign(body), APP_SECRET)).toBe(false);
  });

  it.each([null, "", "sha256=", "sha1=abcdef", "sha256=zz", `sha256=${"0".repeat(63)}`])(
    "weigert een ontbrekende of rare handtekening: %s",
    async (header) => {
      expect(await isValidSignature(bytes(body), header, APP_SECRET)).toBe(false);
    },
  );

  it("weigert alles als het app-secret leeg is", async () => {
    expect(await isValidSignature(bytes(body), `sha256=${"a".repeat(64)}`, "")).toBe(false);
  });
});

describe("teksten veilig vergelijken", () => {
  it("werkt zoals gewoon vergelijken", () => {
    expect(safeEqual("geheim", "geheim")).toBe(true);
    expect(safeEqual("geheim", "geheiM")).toBe(false);
    expect(safeEqual("geheim", "geheim!")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});
