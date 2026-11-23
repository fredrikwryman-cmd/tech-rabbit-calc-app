/**
 * Räkna vidare: vy 05c och 05d i design v2.
 *
 * Från ett svar går det att bygga vidare på resultatet utan att skriva om
 * frågan. Ändringen läggs till den ursprungliga frågan och hela frågan
 * tolkas om. Motorn räknar, AI:n tolkar — precis som första gången. Det finns
 * inget nytt API och ingen egen räkning här: funktionerna i den här filen
 * sätter bara ihop text.
 */

/** Högst så många tecken i "Ändrat"-märket, innan det kortas med ellips. */
const MARKE_MAX = 54;

/**
 * Sätter ihop den ursprungliga frågan och ändringen till EN fråga.
 *
 * Varför en hel fråga i stället för ett följdsvar: följdsvaren är svar på
 * frågor tjänsten själv har ställt, och de skickas bara fyra i taget
 * (api-tolkare.ts). En ändring är inget svar — den är ett tillägg till
 * frågan, och ska tolkas med allt det ursprungliga sammanhanget kvar.
 */
export function byggVidareFraga(ursprunglig: string, andring: string): string {
  const bas = ursprunglig.trim();
  const till = andring.trim();
  if (till === '') return bas;
  if (bas === '') return till;
  // Slutar frågan redan på skiljetecken ska inget läggas till; annars
  // skulle "... styckvis?." bli svårare att tolka, inte lättare.
  const avslutad = /[.!?:;,]$/.test(bas);
  return `${bas}${avslutad ? '' : '.'} ${till}`;
}

/**
 * Texten i det gröna märket ovanför resultatkortet (05d).
 *
 * Märket är en rad hög, så en lång ändring kortas med ellips. Ordet "Ändrat"
 * står i märket, inte här, så att den som läser raden ser vad som ändrats.
 */
export function andringsmarke(andring: string): string {
  const text = andring.trim().replace(/\s+/g, ' ');
  if (text.length <= MARKE_MAX) return text;
  return `${text.slice(0, MARKE_MAX - 1).trimEnd()}…`;
}

/** Förslagen under fältet i 05c. Korta tillägg som passar nästan varje svar. */
export const VIDARE_FORSLAG: readonly string[] = [
  'med 20 % påslag',
  'med moms',
  'per månad i stället',
];
