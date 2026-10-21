import type { CheckResult, Source, Verdict } from "./perplexity";

/** WhatsApp-antwoorden van de bot blijven onder dit aantal tekens. */
export const MAX_REPLY_LENGTH = 900;

/** Slotzin onder elke check. */
export const CLOSING_LINE = "Automatische AI-check, kan fouten bevatten.";

/** Bij een groet of een bericht zonder bewering: in twee zinnen hoe de bot werkt. */
export const HOW_IT_WORKS =
  "Hoi! Stuur me een bewering of een doorgestuurd bericht, dan check ik of het klopt. " +
  "Ik zoek het na op internet en stuur je een oordeel met uitleg en bronnen.";

/** Bij een foto, video, spraakbericht of ander bericht zonder tekst. */
export const ONLY_TEXT =
  "Sorry, ik kan alleen tekst checken, geen foto's, video's of spraakberichten. " +
  "Typ of plak de bewering als tekst, dan zoek ik het voor je uit.";

/** De AI-check duurde langer dan 20 seconden. */
export const TIMEOUT_REPLY =
  "Sorry, het checken duurde te lang. Probeer het over een paar minuten nog eens.";

/** De AI-check is mislukt om een andere reden. */
export const ERROR_REPLY = "Sorry, er ging iets mis bij het checken. Probeer het later nog eens.";

const VERDICT_LABELS: Record<Exclude<Verdict, "no_claim">, string> = {
  true: "✅ Klopt",
  mixed: "⚠️ Deels waar of misleidend",
  false: "❌ Klopt niet",
  unverifiable: "❔ Niet te controleren",
};

/** Kortste uitleg die we nog zinvol vinden voordat we een bron laten vallen. */
const MIN_EXPLANATION_LENGTH = 120;

/**
 * Maakt het WhatsApp-antwoord voor een check:
 *
 *   Oordeel: ...
 *   Uitleg: twee tot vier zinnen
 *   Bronnen: twee of drie links
 *   Automatische AI-check, kan fouten bevatten.
 *
 * Het antwoord is nooit langer dan 900 tekens. Past het niet, dan valt eerst de
 * derde bron weg en wordt daarna de uitleg ingekort.
 */
export function formatCheckReply(result: CheckResult): string {
  const label = VERDICT_LABELS[result.verdict === "no_claim" ? "unverifiable" : result.verdict];
  const explanation = result.explanation.trim() || "Er is geen uitleg beschikbaar.";
  const available = Math.min(3, result.sources.length);
  const preferred = Math.min(2, available);

  // 1. Volledige uitleg, met zoveel mogelijk bronnen (minstens twee als die er zijn).
  for (let count = available; count >= preferred; count--) {
    const sources = result.sources.slice(0, count);
    if (build(label, explanation, sources).length <= MAX_REPLY_LENGTH) {
      return build(label, explanation, sources);
    }
  }

  // 2. Past niet: uitleg inkorten, en alleen bij extreem lange links een bron laten vallen.
  for (let count = preferred; count >= 0; count--) {
    const sources = result.sources.slice(0, count);
    const room = MAX_REPLY_LENGTH - build(label, "", sources).length;
    if (room >= MIN_EXPLANATION_LENGTH || count === 0) {
      return limit(build(label, shorten(explanation, room), sources));
    }
  }
  return limit(build(label, shorten(explanation, MIN_EXPLANATION_LENGTH), []));
}

function build(label: string, explanation: string, sources: Source[]): string {
  const sourceBlock =
    sources.length > 0
      ? `*Bronnen:*\n${sources.map((source, index) => `${index + 1}. ${source.url}`).join("\n")}`
      : "*Bronnen:* geen gevonden";
  return [`*Oordeel:* ${label}`, `*Uitleg:* ${explanation}`, sourceBlock, `_${CLOSING_LINE}_`].join("\n\n");
}

/** Kort een tekst in tot `max` tekens, het liefst na een hele zin. */
export function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 1) return "…";
  const cut = text.slice(0, max - 1);
  const sentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (sentenceEnd >= max * 0.5) return cut.slice(0, sentenceEnd + 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, "")}…`;
}

/** Laatste vangnet: nooit meer dan 900 tekens. */
function limit(text: string): string {
  return text.length <= MAX_REPLY_LENGTH ? text : `${text.slice(0, MAX_REPLY_LENGTH - 1)}…`;
}
