import { describe, expect, it } from "vitest";
import type { CheckResult } from "../src/perplexity";
import { CLOSING_LINE, formatCheckReply, HOW_IT_WORKS, MAX_REPLY_LENGTH, ONLY_TEXT, shorten } from "../src/reply";

const result: CheckResult = {
  verdict: "false",
  explanation: "Er is geen bewijs dat 5G corona veroorzaakt. Virussen verspreiden zich via mensen.",
  sources: [
    { url: "https://nieuwscheckers.nl/5g-veroorzaakt-geen-corona/" },
    { url: "https://www.rivm.nl/5g-en-gezondheid" },
    { url: "https://nos.nl/artikel/2331234-5g-masten" },
  ],
};

describe("opmaak van het antwoord", () => {
  it("heeft de afgesproken vorm", () => {
    expect(formatCheckReply(result)).toBe(
      [
        "*Oordeel:* ❌ Klopt niet",
        "",
        "*Uitleg:* Er is geen bewijs dat 5G corona veroorzaakt. Virussen verspreiden zich via mensen.",
        "",
        "*Bronnen:*",
        "1. https://nieuwscheckers.nl/5g-veroorzaakt-geen-corona/",
        "2. https://www.rivm.nl/5g-en-gezondheid",
        "3. https://nos.nl/artikel/2331234-5g-masten",
        "",
        "_Automatische AI-check, kan fouten bevatten._",
      ].join("\n"),
    );
  });

  it.each([
    ["true", "✅ Klopt"],
    ["mixed", "⚠️ Deels waar of misleidend"],
    ["false", "❌ Klopt niet"],
    ["unverifiable", "❔ Niet te controleren"],
  ] as const)("toont oordeel %s als '%s'", (verdict, label) => {
    expect(formatCheckReply({ ...result, verdict })).toContain(`*Oordeel:* ${label}\n`);
  });

  it("blijft onder de 900 tekens, met minstens twee bronnen", () => {
    const longUrl = (n: number) => `https://www.voorbeeld-nieuws.nl/${"artikel-".repeat(20)}${n}`;
    const reply = formatCheckReply({
      verdict: "mixed",
      explanation: "Dit is een lange zin met uitleg over de bewering. ".repeat(40),
      sources: [{ url: longUrl(1) }, { url: longUrl(2) }, { url: longUrl(3) }],
    });
    expect(reply.length).toBeLessThanOrEqual(MAX_REPLY_LENGTH);
    expect(reply).toContain(longUrl(1));
    expect(reply).toContain(longUrl(2));
    expect(reply).not.toContain(longUrl(3));
    expect(reply.endsWith(`_${CLOSING_LINE}_`)).toBe(true);
  });

  it("laat eerst de derde bron weg voordat de uitleg wordt ingekort", () => {
    // Een uitleg die met drie bronnen net niet past, maar met twee wel.
    const withoutExplanation = formatCheckReply({ ...result, explanation: "x" }).length - 1;
    const explanation = `${"a".repeat(MAX_REPLY_LENGTH - withoutExplanation + 10)}.`;
    expect(withoutExplanation + explanation.length).toBeGreaterThan(MAX_REPLY_LENGTH);

    const reply = formatCheckReply({ ...result, explanation });
    expect(reply.length).toBeLessThanOrEqual(MAX_REPLY_LENGTH);
    expect(reply).toContain(explanation);
    expect(reply).toContain("2. https://");
    expect(reply).not.toContain("3. https://");
  });

  it("meldt het als er geen bronnen zijn", () => {
    const reply = formatCheckReply({ verdict: "unverifiable", explanation: "Niets gevonden.", sources: [] });
    expect(reply).toContain("*Bronnen:* geen gevonden");
  });

  it("zet een standaardzin neer als de uitleg leeg is", () => {
    expect(formatCheckReply({ ...result, explanation: "  " })).toContain("*Uitleg:* Er is geen uitleg beschikbaar.");
  });

  it("vaste berichten zijn kort", () => {
    for (const text of [HOW_IT_WORKS, ONLY_TEXT]) expect(text.length).toBeLessThanOrEqual(MAX_REPLY_LENGTH);
  });
});

describe("inkorten", () => {
  it("knipt het liefst na een hele zin", () => {
    expect(shorten("Eerste zin is hier. Tweede zin is veel langer dan de eerste.", 30)).toBe("Eerste zin is hier.");
  });

  it("knipt anders bij een spatie en zet er … achter", () => {
    expect(shorten("een twee drie vier vijf zes zeven", 16)).toBe("een twee drie…");
  });

  it("laat korte tekst met rust", () => {
    expect(shorten("kort", 10)).toBe("kort");
  });
});
