/**
 * Typer för räknemotorn.
 *
 * Motorn är ren TypeScript utan beroenden. AI:n tolkar frågan till dessa
 * strukturer och förklarar resultatet efteråt — den räknar aldrig själv.
 */

/** De dimensioner motorn kan räkna i. */
export type Dimension = 'vikt' | 'volym' | 'langd' | 'yta' | 'tid' | 'antal';

/** Ett tal med en enhet, t.ex. { value: 300, unit: 'g' }. */
export interface Mangd {
  readonly value: number;
  readonly unit: string;
}

/**
 * Ett steg i "Så räknade jag".
 * Renderas som komponenten Stegrad: `uttryck` med tabulära siffror,
 * `resultat` i mindre dämpad text.
 */
export interface Steg {
  readonly nr: number;
  /** Kort etikett, t.ex. "Kvar att sälja". */
  readonly etikett: string;
  /** Själva räkningen, t.ex. "1 kg − 300 g". */
  readonly uttryck: string;
  /** Vad steget gav, t.ex. "0,7 kg". */
  readonly resultat: string;
}

import type { Praktiskt } from './avrundning.ts';

/**
 * En extra rad under huvudtalet, t.ex. ett pris per förpackningsstorlek.
 * Visas med samma typografi som resultatet, i ordning.
 */
export interface Rad {
  /** Vad raden gäller, t.ex. "5 g" eller "10 g". */
  readonly etikett: string;
  /** Talet i svensk stil, färdigt att visa. */
  readonly formatted: string;
  readonly unit: string;
  /** Det exakta talet, för den som behöver räkna vidare. */
  readonly value: number;
}

/**
 * Ett typat faktum ur räkningen (F03).
 *
 * Förklaringen får bara bygga på de här. Att ett tal stämmer räcker inte —
 * nyckeln säger vad talet BETYDER, så att påslag och marginal inte kan byta
 * plats i texten utan att granskningen märker det.
 */
export type Faktumnyckel =
  | 'inkop' | 'forsaljning' | 'mangd' | 'forbrukat' | 'kvar'
  | 'paslag' | 'marginal' | 'moms' | 'netto' | 'brutto'
  | 'ranta' | 'belopp' | 'timmar' | 'resultat' | 'ovrigt'
  // Vyerna 30-33: jamforpris, delade kostnader, forpackningar och arbetstid.
  | 'perEnhet' | 'skillnad' | 'andel'
  | 'personer' | 'perPerson'
  | 'svinn' | 'forpackningar' | 'overskott'
  | 'arbetstid' | 'lon'
  // Direktiv 22: rabatter, baklanges fran ett mal, aterkommande kostnader,
  // resekostnad och antal salda for break-even.
  | 'pris' | 'rabatt' | 'sparat' | 'mal' | 'period'
  | 'strecka' | 'forbrukning' | 'antal' | 'tackning';

/**
 * Alla giltiga nycklar, som värden.
 *
 * Appen måste kunna kontrollera en nyckel som kommit över nätet, och den
 * kontrollen får aldrig ha en egen kopia av listan: direktiv 19 och 22 lade
 * till nycklar, appens kopia uppdaterades inte, och vyerna 30-33 öppnades
 * därför aldrig från ett riktigt svar (direktiv 25). Listan bor här, hos
 * typen, och TypeScript fäller bygget om de två glider isär.
 */
export const FAKTUMNYCKLAR = [
  'inkop', 'forsaljning', 'mangd', 'forbrukat', 'kvar',
  'paslag', 'marginal', 'moms', 'netto', 'brutto',
  'ranta', 'belopp', 'timmar', 'resultat', 'ovrigt',
  'perEnhet', 'skillnad', 'andel',
  'personer', 'perPerson',
  'svinn', 'forpackningar', 'overskott',
  'arbetstid', 'lon',
  'pris', 'rabatt', 'sparat', 'mal', 'period',
  'strecka', 'forbrukning', 'antal', 'tackning',
] as const satisfies readonly Faktumnyckel[];

/** Sant när strängen är en nyckel motorn känner. */
export function arFaktumnyckel(v: string): v is Faktumnyckel {
  return (FAKTUMNYCKLAR as readonly string[]).includes(v);
}

export interface Faktum {
  readonly nyckel: Faktumnyckel;
  /** Vad talet betyder på vanlig svenska, t.ex. "Inköpspris". */
  readonly betydelse: string;
  readonly value: number;
  readonly formatted: string;
  readonly unit: string;
}

/** Det varje räknefunktion returnerar. */
export interface Resultat {
  /** Det exakta talet. Avrunda aldrig innan det ska visas. */
  readonly value: number;
  /** Enhet att visa efter värdet, t.ex. "kr/kg", "%", "kg". */
  readonly unit: string;
  /** Stegen till "Så räknade jag", i ordning. */
  readonly steps: readonly Steg[];
  /** Värdet i svensk stil, färdigt att visa i resultatkortet. */
  readonly formatted: string;
  /**
   * Vad talet betyder (F13), t.ex. "Minsta pris per skruv". Aldrig "vinst"
   * när bara inköpet är med i räkningen.
   */
  readonly betydelse: string;
  /**
   * Avgörande förutsättningar, t.ex. ["Om alla 260 säljs",
   * "efter inköpskostnaden"]. Får aldrig gömmas bara i "Så räknade jag".
   */
  readonly villkor?: readonly string[];
  /**
   * Värdet som uppfyller målet när avrundning spelar roll (F01), i de fall
   * där det EXAKTA talet är svaret och avrundningen är tillägget.
   *
   * Är målet att täcka en kostnad gäller det omvända: då är det avrundade
   * talet svaret, `value` och `formatted` bär det, och `exakt` bär det exakta.
   * Båda fälten finns aldrig samtidigt.
   */
  readonly praktiskt?: Praktiskt;
  /**
   * Det exakta talet, när `value` är avrundat för att målet kräver det.
   *
   * "Minst 2,88 kr/st" är fel råd: 2,88 × 260 = 748,80 och täcker inte 750.
   * Svaret är 2,89. Det exakta talet visas litet under, för den som vill se
   * var gränsen gick.
   */
  readonly exakt?: {
    readonly value: number;
    readonly formatted: string;
    readonly unit: string;
    /** Varför svaret skiljer sig från det exakta talet. */
    readonly skal: string;
  };
  /** Typade fakta som förklaringen får byggas av (F03). */
  readonly fakta?: readonly Faktum[];
  /**
   * Faktum som motorn antagit och som användaren bör kunna ändra, t.ex.
   * momssatsen när frågan inte sa vilken. Appen visar dem som ändringsbara.
   */
  readonly andringsbart?: readonly Faktumnyckel[];
  /**
   * Flera svar, när frågan har flera. En rad per förpackningsstorlek.
   * Saknas fältet har frågan ett enda svar.
   */
  readonly rader?: readonly Rad[];
}

/** Fel som motorn kastar. Meddelandet är skrivet för att kunna visas. */
export class RaknefelError extends Error {
  readonly kod: Raknefelkod;
  constructor(kod: Raknefelkod, meddelande: string) {
    super(meddelande);
    this.name = 'RaknefelError';
    this.kod = kod;
  }
}

export type Raknefelkod =
  | 'okand-enhet'
  | 'olika-dimensioner'
  | 'ogiltigt-tal'
  | 'ogiltigt-uttryck'
  | 'division-med-noll'
  | 'negativ-kvarvarande';
