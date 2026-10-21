import { describe, expect, it } from "vitest";
import { buildInput, cleanUrl, MAX_INPUT_CHARS, parseAgentResponse, parseAnswerText } from "../src/perplexity";
import { agentResponse, FALSE_CLAIM_ANSWER, SEARCH_RESULTS } from "./helpers";

describe("antwoord van Perplexity lezen", () => {
  it("leest oordeel, uitleg en bronnen uit output_text en search_results", () => {
    const result = parseAgentResponse(agentResponse(FALSE_CLAIM_ANSWER));
    expect(result).toEqual({
      verdict: "false",
      explanation:
        "Er is geen wetenschappelijk bewijs dat 5G corona veroorzaakt of verspreidt. " +
        "Virussen verspreiden zich via mensen, niet via radiogolven.",
      sources: [
        { url: "https://nieuwscheckers.nl/5g-veroorzaakt-geen-corona/", title: "5G veroorzaakt geen corona | Nieuwscheckers" },
        { url: "https://www.rivm.nl/5g-en-gezondheid", title: "5G en gezondheid | RIVM" },
      ],
    });
  });

  it("werkt ook zonder output_text, met alleen het message-item", () => {
    const result = parseAgentResponse(agentResponse(FALSE_CLAIM_ANSWER, SEARCH_RESULTS, { withOutputText: false }));
    expect(result?.verdict).toBe("false");
    expect(result?.sources).toHaveLength(2);
  });

  it("begrijpt genummerde verwijzingen zoals [1][3] (preset fast)", () => {
    const result = parseAgentResponse(agentResponse("OORDEEL: Klopt\nUITLEG: Dat klopt [3][1]."));
    expect(result?.verdict).toBe("true");
    expect(result?.sources.map((source) => source.url)).toEqual([
      "https://nos.nl/artikel/2331234-5g-masten",
      "https://www.rivm.nl/5g-en-gezondheid",
    ]);
  });

  it("vult aan tot twee bronnen als de uitleg er maar één noemt", () => {
    const result = parseAgentResponse(agentResponse("OORDEEL: Klopt niet\nUITLEG: Onjuist [web:3]."));
    expect(result?.sources.map((source) => source.url)).toEqual([
      "https://nos.nl/artikel/2331234-5g-masten",
      "https://www.rivm.nl/5g-en-gezondheid",
    ]);
  });

  it("geeft nooit meer dan drie bronnen", () => {
    const result = parseAgentResponse(
      agentResponse("OORDEEL: Klopt niet\nUITLEG: Onjuist [web:1][web:2][web:3][web:4]."),
    );
    expect(result?.sources).toHaveLength(3);
  });

  it("gebruikt alleen links uit de zoekresultaten, nooit links uit de tekst van de AI", () => {
    const result = parseAgentResponse(
      agentResponse(
        "OORDEEL: Klopt niet\nUITLEG: Volgens [de overheid](https://verzonnen.example/bron) en https://nep.example klopt dit niet [web:2].",
      ),
    );
    expect(result?.explanation).toBe("Volgens de overheid en klopt dit niet.");
    expect(result?.sources.map((source) => source.url)).not.toContain("https://verzonnen.example/bron");
    expect(result?.sources.map((source) => source.url)).not.toContain("https://nep.example");
  });

  it("geeft een lege bronnenlijst als er geen zoekresultaten zijn", () => {
    const result = parseAgentResponse(agentResponse("OORDEEL: Niet te controleren\nUITLEG: Niets gevonden.", []));
    expect(result).toEqual({ verdict: "unverifiable", explanation: "Niets gevonden.", sources: [] });
  });

  it("geeft null als er geen tekst is", () => {
    expect(parseAgentResponse({ status: "failed", output: [] })).toBeNull();
    expect(parseAgentResponse("onzin")).toBeNull();
  });
});

describe("de tekst van de AI lezen", () => {
  it.each([
    ["OORDEEL: Klopt", "true"],
    ["OORDEEL: Deels waar of misleidend", "mixed"],
    ["OORDEEL: Klopt niet", "false"],
    ["OORDEEL: Niet te controleren", "unverifiable"],
    ["OORDEEL: Geen bewering", "no_claim"],
    ["**OORDEEL:** Klopt niet", "false"],
    ["Oordeel: *Deels waar*", "mixed"],
    ["- OORDEEL: klopt.", "true"],
  ])("%s → %s", (line, verdict) => {
    expect(parseAnswerText(`${line}\nUITLEG: Uitleg.`)?.verdict).toBe(verdict);
  });

  it("vindt de uitleg ook op dezelfde regel als het oordeel", () => {
    expect(parseAnswerText("OORDEEL: Klopt niet UITLEG: Het is anders [web:1].")).toMatchObject({
      verdict: "false",
      explanation: "Het is anders.",
      citedIds: [1],
    });
  });

  it("begrijpt een antwoord dat zonder 'OORDEEL:' met het oordeel begint", () => {
    expect(parseAnswerText("Klopt niet. De bewering is onjuist [1].")).toMatchObject({
      verdict: "false",
      explanation: "De bewering is onjuist.",
      citedIds: [1],
    });
  });

  it("ziet 'Waarschijnlijk' niet aan voor het oordeel 'waar'", () => {
    expect(parseAnswerText("Waarschijnlijk gaat het om een grap.")).toBeNull();
  });

  it("laat een eigen bronnenlijst van de AI weg uit de uitleg", () => {
    const parsed = parseAnswerText(
      "OORDEEL: Klopt\nUITLEG: Dat klopt [web:1].\nBRONNEN:\n1. https://www.rivm.nl\n2. https://nos.nl",
    );
    expect(parsed?.explanation).toBe("Dat klopt.");
  });

  it("geeft null als er geen oordeel in staat", () => {
    expect(parseAnswerText("Ik weet het niet zeker.")).toBeNull();
    expect(parseAnswerText("")).toBeNull();
  });
});

describe("invoer voor de AI", () => {
  it("bevat de datum en het bericht", () => {
    const input = buildInput("Kaas is gezond", new Date("2026-10-21T10:00:00Z"));
    expect(input).toContain("21 oktober 2026");
    expect(input).toContain('"""\nKaas is gezond\n"""');
  });

  it("kort heel lange berichten in", () => {
    const input = buildInput("a".repeat(MAX_INPUT_CHARS + 500), new Date("2026-10-21T10:00:00Z"));
    expect(input).toContain(`${"a".repeat(MAX_INPUT_CHARS)} …`);
    expect(input).not.toContain("a".repeat(MAX_INPUT_CHARS + 1));
  });
});

describe("links opschonen", () => {
  it("haalt volgcodes en ankers weg", () => {
    expect(cleanUrl("https://nos.nl/artikel/1?utm_source=x&id=5&fbclid=abc#top")).toBe("https://nos.nl/artikel/1?id=5");
  });

  it("weigert andere soorten links en extreem lange links", () => {
    expect(cleanUrl("javascript:alert(1)")).toBeNull();
    expect(cleanUrl("geen link")).toBeNull();
    expect(cleanUrl(`https://voorbeeld.nl/${"x".repeat(400)}`)).toBeNull();
  });
});
