/**
 * Avrundning som uppfyller målet (F01).
 *
 * Ett svar som säger "täcker kostnaden" måste hålla det löftet när priset
 * faktiskt används. 750 kr delat på 260 skruvar är 2,8846… kr/st. Avrundat
 * till visning blir det 2,88 — men 2,88 × 260 är 748,80 kr, och då saknas
 * 1,20 kr. Det praktiska priset är därför 2,89, avrundat uppåt.
 *
 * Riktningen följer målet, inte talet:
 *   minsta-pris          uppåt, annars täcks inte kostnaden
 *   hogsta-kostnad       nedåt, annars spräcks taket
 *   antal-forpackningar  uppåt till heltal, man köper inte en halv låda
 *
 * Räkningen sker i heltal av minsta valutaenhet. Binär flyttalsaritmetik får
 * inte avgöra om ett mål uppfylls: 2,89 × 100 är 288,99999999999994 i
 * flyttal, och en golvning där hade gett fel svar.
 */

import { formatTal } from './format.ts';

export type Avrundningsmal =
  | 'minsta-pris'
  | 'hogsta-kostnad'
  | 'antal-forpackningar'
  | 'ingen';

/**
 * Målen som värden, för den som måste kontrollera en sträng.
 *
 * Appen läste tjänstens svar mot en EGEN kopia av den här listan. Kopian var
 * i takt den här gången, men samma sorts kopia av faktumnycklarna kostade
 * vyerna 30-33 (direktiv 25). Listan bor hos typen, och `satisfies` gör att
 * bygget faller om de glider isär.
 */
export const AVRUNDNINGSMAL = [
  'minsta-pris',
  'hogsta-kostnad',
  'antal-forpackningar',
  'ingen',
] as const satisfies readonly Avrundningsmal[];

/** Sant när strängen är ett avrundningsmål motorn känner. */
export function arAvrundningsmal(v: string): v is Avrundningsmal {
  return (AVRUNDNINGSMAL as readonly string[]).includes(v);
}

/**
 * Minsta steg en valuta kan uttryckas i.
 *
 * Två decimaler får inte antas universellt: japanska yen har inga, och ett
 * styckpris i öre är inte samma sak som ett partipris. Okänd valuta behandlas
 * som tvådecimalsvaluta, vilket är det vanligaste, men det är ett antagande
 * och inte en sanning.
 */
const VALUTASTEG: Readonly<Record<string, number>> = {
  kr: 0.01,
  sek: 0.01,
  eur: 0.01,
  usd: 0.01,
  gbp: 0.01,
  jpy: 1,
  isk: 1,
};

export function valutasteg(valuta: string): number {
  return VALUTASTEG[valuta.trim().toLowerCase()] ?? 0.01;
}

/** Antal decimaler ett steg motsvarar: 0,01 → 2, 1 → 0. */
export function stegdecimaler(steg: number): number {
  if (steg >= 1) return 0;
  return Math.max(0, Math.round(-Math.log10(steg)));
}

/**
 * Avrundar i heltal av minsta enhet, så att flyttalsfel inte avgör riktningen.
 *
 * En liten tolerans tas med innan riktningen bestäms: ett värde som ligger
 * inom en miljondels enhet från ett jämnt steg räknas som att det ligger på
 * steget. Annars skulle 7000 / 100 kunna rundas upp till 70,01 av ett fel i
 * sista biten.
 */
function avrundaTillSteg(varde: number, steg: number, riktning: 'upp' | 'ned'): number {
  const enheter = varde / steg;
  const narmaste = Math.round(enheter);
  if (Math.abs(enheter - narmaste) < 1e-9) return narmaste * steg;
  const ut = riktning === 'upp' ? Math.ceil(enheter) : Math.floor(enheter);
  return ut * steg;
}

export interface Praktiskt {
  /** Det värde som faktiskt uppfyller målet. */
  readonly value: number;
  /** Värdet i svensk stil, färdigt att visa. */
  readonly formatted: string;
  readonly unit: string;
  /** Kort rad om varför det skiljer sig från visningsvärdet. */
  readonly skal: string;
  /** Vad avrundningen gjordes åt. */
  readonly mal: Avrundningsmal;
}

export interface PraktisktAlternativ {
  readonly unit: string;
  /** Valutan som styr steget. Standard kr. */
  readonly valuta?: string;
  /** Eget steg, när försäljningsenheten inte är valutans minsta enhet. */
  readonly steg?: number;
  /** Mängden värdet multipliceras med när målet kontrolleras, t.ex. 260 st. */
  readonly mangd?: number;
  /** Totalbeloppet som ska täckas, t.ex. 750 kr. */
  readonly tacker?: number;
}

/**
 * Det praktiska värdet, eller null när avrundningen inte ändrar något.
 *
 * Null betyder "visningsvärdet duger": då ska appen inte visa en extra rad.
 */
export function praktisktVarde(
  exakt: number,
  mal: Avrundningsmal,
  alt: PraktisktAlternativ,
): Praktiskt | null {
  if (mal === 'ingen' || !Number.isFinite(exakt)) return null;

  const steg =
    mal === 'antal-forpackningar' ? 1 : (alt.steg ?? valutasteg(alt.valuta ?? 'kr'));
  const decimaler = stegdecimaler(steg);

  const visning = avrundaTillSteg(exakt, steg, 'ned') === exakt
    ? exakt
    : Number(exakt.toFixed(Math.max(decimaler, 0)));

  const riktning = mal === 'hogsta-kostnad' ? 'ned' : 'upp';
  const praktiskt = avrundaTillSteg(exakt, steg, riktning);

  // Ingen skillnad att berätta om.
  if (Math.abs(praktiskt - visning) < steg / 1000) return null;

  let skal: string;
  if (mal === 'minsta-pris') {
    const brist =
      alt.mangd !== undefined && alt.tacker !== undefined
        ? alt.tacker - visning * alt.mangd
        : null;
    skal =
      brist !== null && brist > 0
        ? `Avrundat uppåt. ${formatTal(visning, decimaler)} ${alt.unit} ger ${formatTal(visning * alt.mangd!, 2)} och täcker inte hela inköpet.`
        : 'Avrundat uppåt så att hela inköpet täcks.';
  } else if (mal === 'hogsta-kostnad') {
    skal = 'Avrundat nedåt så att taket inte spräcks.';
  } else {
    skal = 'Avrundat uppåt till hela förpackningar.';
  }

  return {
    value: praktiskt,
    formatted: formatTal(praktiskt, decimaler),
    unit: alt.unit,
    skal,
    mal,
  };
}

/** Täcker värdet målet? Används i tester och av motorn, aldrig av AI:n. */
export function tackerMalet(varde: number, mangd: number, tacker: number): boolean {
  // Heltal av ören, så att 2,88 × 260 inte blir 748,8000000000001.
  const oren = Math.round(varde * 100) * mangd;
  return oren + 1e-6 >= Math.round(tacker * 100);
}
