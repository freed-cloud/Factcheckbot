import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";

/** Zo lang onthouden we dat een bericht al binnen was. */
export const KEEP_FOR_MS = 2 * 24 * 60 * 60 * 1000;
/** Zo vaak ruimen we oude codes op. */
export const CLEANUP_EVERY_MS = 12 * 60 * 60 * 1000;
/** Maximaal aantal sleutels per delete-opdracht van Cloudflare. */
const DELETE_BATCH = 128;

/**
 * Een kleine opslag bij Cloudflare (een Durable Object) die onthoudt welke berichten
 * al binnen zijn. Meta stuurt hetzelfde bericht soms twee keer; zo krijgt de gebruiker
 * toch maar één antwoord.
 *
 * Er staat alleen een onherkenbare code (SHA-256-hash) van het bericht-ID in, nooit
 * de tekst of het telefoonnummer. Na twee dagen wordt de code verwijderd.
 * Je hoeft hiervoor niets in te stellen: Cloudflare maakt de opslag zelf aan.
 */
export class SeenMessages extends DurableObject<Env> {
  /** Geeft true de eerste keer dat een code langskomt, en false bij elke herhaling. */
  async firstTime(key: string): Promise<boolean> {
    const storage = this.ctx.storage;
    if ((await storage.get<number>(key)) !== undefined) return false;
    await storage.put(key, Date.now());
    if ((await storage.getAlarm()) === null) await storage.setAlarm(Date.now() + CLEANUP_EVERY_MS);
    return true;
  }

  /** Ruimt codes op die ouder zijn dan twee dagen. */
  override async alarm(): Promise<void> {
    const storage = this.ctx.storage;
    const cutoff = Date.now() - KEEP_FOR_MS;
    const entries = await storage.list<number>();
    const expired: string[] = [];
    for (const [key, seenAt] of entries) {
      if (typeof seenAt !== "number" || seenAt < cutoff) expired.push(key);
    }
    for (let i = 0; i < expired.length; i += DELETE_BATCH) {
      await storage.delete(expired.slice(i, i + DELETE_BATCH));
    }
    if (entries.size > expired.length) await storage.setAlarm(Date.now() + CLEANUP_EVERY_MS);
  }
}
