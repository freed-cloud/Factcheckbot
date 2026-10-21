/**
 * Logregels voor het Cloudflare-dashboard (Worker > Observability).
 *
 * Privacy: zet hier nooit berichtteksten, telefoonnummers, gebruikers-ID's of
 * foutmeldingen van buitenaf in. Alleen een gebeurtenis, aantallen, statuscodes
 * en korte hints die we zelf schrijven.
 */
export type LogDetails = Record<string, string | number | boolean>;
export type LogLevel = "info" | "warn" | "error";

export function log(event: string, details: LogDetails = {}, level: LogLevel = "info"): void {
  const line = JSON.stringify({ event, ...details });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Alleen de soort fout, nooit de foutmelding zelf: die kan stukjes van een bericht bevatten. */
export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
