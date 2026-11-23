import { type Dimension, RaknefelError } from './typer.ts';

/**
 * Enhetstabell. Varje enhet har en faktor till sin dimensions huvudenhet.
 *
 * Huvudenheter: vikt kg, volym l, längd m, yta m², tid s, antal st.
 * Huvudenheten är den enhet ett svar landar i när inget annat begärs.
 */
export interface Enhet {
  /** Kanoniskt namn, det som visas. */
  readonly namn: string;
  readonly dimension: Dimension;
  /**
   * Hur många huvudenheter en enhet av detta slag är.
   * `null` för pkt, låda och pall: storleken står i `perPackage`, inte här.
   */
  readonly faktor: number | null;
}

/** [ANTAGANDE] Tid: en månad är 30 dygn, ett år är 365 dygn. */
const DYGN = 86_400;
export const TID_MANAD_DYGN = 30;
export const TID_AR_DYGN = 365;

/**
 * Förpackningsenheter: pkt, låda och pall har ingen fast storlek.
 *
 * Hur många styck som ryms i en förpackning är en uppgift om varan, inte om
 * enheten. Motorn gissar aldrig. Räkningen kräver `perPackage`; saknas den
 * svarar motorn `{ needs: 'perPackage' }` i stället för att räkna fel.
 */
export const FORPACKNINGSENHETER = ['pkt', 'låda', 'pall'] as const;
export type Forpackningsenhet = (typeof FORPACKNINGSENHETER)[number];

/**
 * Hur många styck en förpackning rymmer.
 *
 * Som tal: gäller den förpackningsenhet räkningen använder. Det fungerar bara
 * när en enda förpackningsenhet är inblandad.
 * Som tabell: ett värde per förpackningsenhet, t.ex. `{ låda: 24, pall: 480 }`.
 */
export type PerPackage = number | Partial<Record<Forpackningsenhet, number>>;

/**
 * Motorns svar när en uppgift saknas och den vägrar gissa.
 *
 * `perPackage`: hur många styck en förpackning rymmer.
 * `timmar`: hur många timmar en månad räknas som. En månad har inget bestämt
 * antal arbetstimmar, så det är användarens uppgift att lämna.
 */
export interface Behov {
  readonly needs: 'perPackage' | 'timmar';
}

export const BEHOVER_PERPACKAGE: Behov = { needs: 'perPackage' };
export const BEHOVER_TIMMAR: Behov = { needs: 'timmar' };

/** Skiljer ett behov från ett resultat. */
export function arBehov<T extends object>(svar: T | Behov): svar is Behov {
  return typeof svar === 'object' && svar !== null && 'needs' in svar;
}

export function arForpackningsenhet(namn: string): namn is Forpackningsenhet {
  return (FORPACKNINGSENHETER as readonly string[]).includes(namn);
}

const ENHETER: readonly Enhet[] = [
  // vikt → kg
  { namn: 'mg', dimension: 'vikt', faktor: 1e-6 },
  { namn: 'g', dimension: 'vikt', faktor: 1e-3 },
  { namn: 'hg', dimension: 'vikt', faktor: 0.1 },
  { namn: 'kg', dimension: 'vikt', faktor: 1 },
  { namn: 'ton', dimension: 'vikt', faktor: 1000 },
  // volym → l
  { namn: 'ml', dimension: 'volym', faktor: 1e-3 },
  { namn: 'cl', dimension: 'volym', faktor: 1e-2 },
  { namn: 'dl', dimension: 'volym', faktor: 0.1 },
  { namn: 'l', dimension: 'volym', faktor: 1 },
  { namn: 'm³', dimension: 'volym', faktor: 1000 },
  // längd → m
  { namn: 'mm', dimension: 'langd', faktor: 1e-3 },
  { namn: 'cm', dimension: 'langd', faktor: 1e-2 },
  { namn: 'm', dimension: 'langd', faktor: 1 },
  { namn: 'km', dimension: 'langd', faktor: 1000 },
  // yta → m²
  { namn: 'cm²', dimension: 'yta', faktor: 1e-4 },
  { namn: 'm²', dimension: 'yta', faktor: 1 },
  { namn: 'hektar', dimension: 'yta', faktor: 10_000 },
  // tid → s
  { namn: 's', dimension: 'tid', faktor: 1 },
  { namn: 'min', dimension: 'tid', faktor: 60 },
  { namn: 'h', dimension: 'tid', faktor: 3600 },
  { namn: 'dygn', dimension: 'tid', faktor: DYGN },
  { namn: 'vecka', dimension: 'tid', faktor: 7 * DYGN },
  { namn: 'månad', dimension: 'tid', faktor: TID_MANAD_DYGN * DYGN },
  { namn: 'år', dimension: 'tid', faktor: TID_AR_DYGN * DYGN },
  // antal → st
  { namn: 'st', dimension: 'antal', faktor: 1 },
  // Ingen fast storlek. Se FORPACKNINGSENHETER och perPackage.
  { namn: 'pkt', dimension: 'antal', faktor: null },
  { namn: 'låda', dimension: 'antal', faktor: null },
  { namn: 'pall', dimension: 'antal', faktor: null },
];

/** Huvudenhet per dimension. */
export const HUVUDENHET: Readonly<Record<Dimension, string>> = {
  vikt: 'kg',
  volym: 'l',
  langd: 'm',
  yta: 'm²',
  tid: 's',
  antal: 'st',
};

/** Skrivsätt som pekar på samma enhet. Nyckeln är normaliserad (gemener, trimmad). */
const ALIAS: Readonly<Record<string, string>> = {
  milligram: 'mg',
  gram: 'g',
  hektogram: 'hg',
  kilo: 'kg',
  kilogram: 'kg',
  tonn: 'ton',
  milliliter: 'ml',
  centiliter: 'cl',
  deciliter: 'dl',
  liter: 'l',
  m3: 'm³',
  kubikmeter: 'm³',
  millimeter: 'mm',
  centimeter: 'cm',
  meter: 'm',
  kilometer: 'km',
  mil: 'km',
  cm2: 'cm²',
  kvadratcentimeter: 'cm²',
  m2: 'm²',
  kvm: 'm²',
  kvadratmeter: 'm²',
  ha: 'hektar',
  sek: 's',
  sekund: 's',
  sekunder: 's',
  minut: 'min',
  minuter: 'min',
  tim: 'h',
  timme: 'h',
  timmar: 'h',
  d: 'dygn',
  dag: 'dygn',
  dagar: 'dygn',
  veckor: 'vecka',
  v: 'vecka',
  manad: 'månad',
  månader: 'månad',
  manader: 'månad',
  ar: 'år',
  år: 'år',
  'års': 'år',
  styck: 'st',
  stycken: 'st',
  stk: 'st',
  paket: 'pkt',
  pack: 'pkt',
  lada: 'låda',
  lådor: 'låda',
  kartong: 'låda',
  pallar: 'pall',
};

const KARTA: Map<string, Enhet> = new Map();
for (const e of ENHETER) KARTA.set(e.namn.toLowerCase(), e);

function normalisera(namn: string): string {
  return namn.trim().toLowerCase().replace(/\.$/, '');
}

/** Slår upp en enhet. Kastar RaknefelError('okand-enhet') om den inte finns. */
export function slaUppEnhet(namn: string): Enhet {
  const n = normalisera(namn);
  const direkt = KARTA.get(n);
  if (direkt) return direkt;
  const viaAlias = ALIAS[n];
  if (viaAlias) {
    const e = KARTA.get(viaAlias.toLowerCase());
    if (e) return e;
  }
  throw new RaknefelError('okand-enhet', `Enheten "${namn}" känner jag inte igen.`);
}

/** Alla enheter motorn kan räkna med, grupperade per dimension. */
export function enheterPerDimension(): Readonly<Record<Dimension, readonly string[]>> {
  const ut: Record<Dimension, string[]> = {
    vikt: [], volym: [], langd: [], yta: [], tid: [], antal: [],
  };
  for (const e of ENHETER) ut[e.dimension].push(e.namn);
  return ut;
}

/**
 * Faktorn till huvudenheten.
 *
 * För pkt, låda och pall hämtas den ur `perPackage`. Saknas den returneras
 * `undefined`, och den som frågade svarar `{ needs: 'perPackage' }`.
 *
 * Ett tal i `perPackage` gäller bara när `ensam` är sant, alltså när räkningen
 * har en enda förpackningsenhet. Annars vet vi inte vilken enhet talet rör.
 */
export function faktorTillHuvudenhet(
  enhet: Enhet,
  perPackage?: PerPackage,
  ensam = true,
): number | undefined {
  if (enhet.faktor !== null) return enhet.faktor;
  if (perPackage === undefined) return undefined;
  if (typeof perPackage === 'number') {
    if (!ensam || !Number.isFinite(perPackage) || perPackage <= 0) return undefined;
    return perPackage;
  }
  const varde = arForpackningsenhet(enhet.namn) ? perPackage[enhet.namn] : undefined;
  if (varde === undefined || !Number.isFinite(varde) || varde <= 0) return undefined;
  return varde;
}

/** Förpackningsenheterna i en uppsättning enheter, utan dubbletter. */
export function forpackningsenheterI(...enheter: readonly Enhet[]): readonly Forpackningsenhet[] {
  const ut: Forpackningsenhet[] = [];
  for (const e of enheter) {
    if (arForpackningsenhet(e.namn) && !ut.includes(e.namn)) ut.push(e.namn);
  }
  return ut;
}
