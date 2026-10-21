import { describe, expect, it } from "vitest";
import { isGreetingOrHelp } from "../src/greeting";

describe("groeten en vragen om hulp herkennen", () => {
  it.each(["Hoi", "Hoi!", "hallo daar 👋", "Goedemorgen", "👍", "???", "Hoe werkt dit?", "Wat kun je?", "Bedankt!", "Oké top", "test"])(
    "'%s' is geen bewering",
    (text) => {
      expect(isGreetingOrHelp(text)).toBe(true);
    },
  );

  it.each([
    "5G verspreidt corona",
    "Corona is nep",
    "Hoe werkt het vaccin echt?",
    "Is het waar dat de AOW-leeftijd omlaag gaat?",
    "Hallo, klopt het dat Albert Heijn morgen dicht is?",
  ])("'%s' gaat naar de AI", (text) => {
    expect(isGreetingOrHelp(text)).toBe(false);
  });
});
