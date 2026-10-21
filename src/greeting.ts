/**
 * Woorden die samen geen bewering vormen: groeten, bedankjes, vragen om hulp.
 * Bestaat een bericht alleen uit deze woorden (of alleen uit emoji), dan legt de bot
 * meteen uit hoe hij werkt, zonder de (betaalde) AI te vragen.
 */
const SMALL_TALK = new Set([
  // groeten
  "hoi", "hallo", "hey", "hee", "hi", "hai", "hello", "hoihoi", "goedemorgen", "goedemiddag",
  "goedenavond", "goedenacht", "goeiemorgen", "morgen", "middag", "avond", "dag", "daag",
  "yo", "moi", "moin", "doei", "groetjes", "welkom",
  // hulp
  "help", "hulp", "info", "informatie", "start", "begin", "menu", "test", "testen", "uitleg",
  // bedankjes en korte reacties
  "bedankt", "dankje", "dankjewel", "dankuwel", "dank", "thanks", "thank", "thx", "merci",
  "top", "super", "mooi", "fijn", "prima", "oke", "ok", "okay", "okee", "ja", "nee", "cool",
  "nice", "lol", "haha", "hihi",
  // opvulwoorden in zinnetjes als "hoe werkt dit?" of "wat kun je?"
  "daar", "allemaal", "bot", "factcheckbot", "factcheck", "hoe", "werkt", "dit", "het", "wat",
  "kun", "kan", "je", "jij", "u", "doen", "ik", "nog", "even", "wel", "mij", "me", "graag",
  "heel", "erg", "veel", "goed", "voor", "de", "een", "zeer", "hartelijk", "you", "is", "er",
]);

const MAX_WORDS = 6;

export function isGreetingOrHelp(text: string): boolean {
  const words = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) return true; // alleen emoji of leestekens
  if (words.length > MAX_WORDS) return false;
  return words.every((word) => SMALL_TALK.has(word));
}
