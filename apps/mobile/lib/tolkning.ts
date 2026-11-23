/**
 * Gränssnittet mellan vyerna och tolkningen av frågan.
 *
 * Formerna här är samma som `apps/api/src/kontrakt.ts`. Håll dem i takt:
 * ändras den ena ska den andra ändras i samma commit.
 *
 * Vyerna känner bara den här filen. Bakom den ligger stubParser.ts i
 * utvecklingsbyggen och API-anropet i drift.
 */

import type { Faktumnyckel, Rad, Resultat } from '@techrabbit/engine';

/** Ett val vid tvetydighet (F06). Inget är förvalt. */
export interface Val {
  readonly id: string;
  readonly titel: string;
  /** Kort följd av valet, t.ex. "Påslag. Priset blir 52 kr." */
  readonly under: string;
}

/**
 * En följdfråga: ett värde saknas, eller målet behöver preciseras.
 *
 * Bär `choices` är det vy 04b (tvetydighet): användaren väljer, skriver inte.
 * Annars är det vy 04a, med `reason` som raden "Varför jag frågar".
 */
export interface Foljdfraga {
  readonly sort: 'foljdfraga';
  /** Frågan som ställs, t.ex. "Hur mycket använder du själv?". */
  readonly fraga: string;
  /** Enheten som visas till höger i svarsfältet, t.ex. "gram". */
  readonly enhet: string;
  /** Förifyllt förslag, om det finns ett. */
  readonly forslag?: string;
  /** F07: varför uppgiften behövs. Raden "Varför jag frågar" i vy 04a. */
  readonly reason?: string;
  /** F06: högst tre val. Finns de är det vy 04b. */
  readonly choices?: readonly Val[];
  /**
   * F05: det servern redan förstått. Appen skickar tillbaka det oförändrat
   * med svaret, så att inget behöver frågas två gånger. Tjänsten är
   * tillståndslös och äger inget mellan två anrop.
   */
  readonly kant?: unknown;
}

/** Ett färdigt svar: motorn har räknat, AI:n har förklarat. */
export interface Svar {
  readonly sort: 'svar';
  /** Etiketten över siffran, t.ex. "Minsta pris per skruv". */
  readonly etikett: string;
  /** Bär villkor, praktiskt pris, rader, fakta och andringsbart. */
  readonly resultat: Resultat;
  /** Förklaringen i löpande text. AI:n skriver den, motorn räknar. */
  readonly forklaring: string;
}

/**
 * Feltyperna servern skickar (F10). Varje typ har en egen nästa handling.
 * `ingen-anslutning` finns bara i appen: servern kan inte svara på ett anrop
 * som aldrig kom fram.
 */
export type Feltyp =
  | 'server'
  | 'rate_limited'
  | 'unparseable'
  | 'unsupported'
  | 'invalid_input'
  | 'ingen-anslutning';

/** Felsorterna vyerna ritar. */
export type Felsort = 'ingen-anslutning' | 'kunde-inte-tolka' | 'for-manga-forsok';

export interface Fel {
  readonly sort: 'fel';
  readonly fel: Felsort;
  /** F10: den riktiga feltypen, när servern lämnat en. */
  readonly typ?: Feltyp;
  /** Ersätter vyns standardtext när tjänsten har något ärligare att säga. */
  readonly meddelande?: string;
  /** "Menade du?" — omformuleringar servern redan provat mot räknemotorn. */
  readonly forslag?: readonly string[];
  /** Sekunder till nästa försök. Bara när servern faktiskt lämnat en. */
  readonly retryAfter?: number;
}

export type Tolkningssvar = Foljdfraga | Svar | Fel;

/** Ett svar på en följdfråga. Kedjan skickas med, inte bara det senaste. */
export interface Foljdsvar {
  readonly fraga: string;
  readonly varde: string;
}

export interface Fragekontext {
  /**
   * Svaren på tidigare följdfrågor, i ordning. Servern är tillståndslös, så
   * hela kedjan skickas: en fråga kan behöva två svar.
   */
  readonly foljdsvar?: readonly Foljdsvar[];
  /** F05: tolkningen servern redan gjort, oförändrad tillbaka. */
  readonly tidigareTolkning?: unknown;
  /** Om telefonen har nät. Utan nät blir svaret alltid 'ingen-anslutning'. */
  readonly harNat: boolean;
}

/** Det vyerna anropar. stubParser och API-anropet uppfyller samma form. */
export interface Tolkare {
  tolka(fraga: string, kontext: Fragekontext): Promise<Tolkningssvar>;
}

// ---------------------------------------------------------------------------
// Hjälpare som vyerna och lagringen delar
// ---------------------------------------------------------------------------

/** Sammanfattningen på den hopfällda raden "Jag räknade med". */
export function sammanfattaFakta(resultat: Resultat): string {
  const fakta = resultat.fakta ?? [];
  return fakta
    .filter((f) => f.nyckel !== 'resultat')
    .slice(0, 3)
    .map((f) => `${f.betydelse.toLowerCase()} ${f.formatted} ${f.unit}`.trim())
    .join(' · ');
}

/**
 * Går faktumet att ändra?
 *
 * Bara det motorn själv pekat ut i `andringsbart`. Allt annat är antingen
 * taget ur frågan eller härlett ur andra värden, och ett härlett värde som
 * går att skriva i vore en lögn om vad som räknas ut.
 */
export function arAndringsbart(resultat: Resultat, nyckel: Faktumnyckel): boolean {
  return (resultat.andringsbart ?? []).includes(nyckel);
}

/** Raderna när frågan har flera svar. Tom lista när den har ett. */
export function raderna(resultat: Resultat): readonly Rad[] {
  return resultat.rader ?? [];
}
