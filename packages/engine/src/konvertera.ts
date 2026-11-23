import { type Mangd, type Resultat, type Steg, RaknefelError } from './typer.ts';
import {
  type Behov,
  BEHOVER_PERPACKAGE,
  faktorTillHuvudenhet,
  forpackningsenheterI,
  HUVUDENHET,
  type PerPackage,
  slaUppEnhet,
} from './enheter.ts';
import { formatMangd, formatTal } from './format.ts';

export interface KonverteraAlternativ {
  /**
   * Hur många styck en förpackning rymmer. Krävs så fort pkt, låda eller pall
   * är med i räkningen. Saknas den svarar convert `{ needs: 'perPackage' }`.
   */
  readonly perPackage?: PerPackage;
}

function kravTal(varde: number, vad: string): number {
  if (typeof varde !== 'number' || !Number.isFinite(varde)) {
    throw new RaknefelError('ogiltigt-tal', `${vad} måste vara ett tal.`);
  }
  return varde;
}

/**
 * Räknar om ett värde mellan två enheter i samma dimension.
 *
 * convert(1, 'kg', 'g') → 1000 g
 *
 * Förpackning mot styck kräver perPackage, eftersom pkt, låda och pall inte
 * har någon fast storlek:
 *
 * convert(1, 'låda', 'st')                      → { needs: 'perPackage' }
 * convert(1, 'låda', 'st', { perPackage: 24 })  → 24 st
 */
export function convert(
  value: number,
  from: string,
  to: string,
  alternativ?: KonverteraAlternativ,
): Resultat | Behov {
  kravTal(value, 'Värdet');
  const fran = slaUppEnhet(from);
  const till = slaUppEnhet(to);

  if (fran.dimension !== till.dimension) {
    throw new RaknefelError(
      'olika-dimensioner',
      `${fran.namn} och ${till.namn} mäter inte samma sak (${fran.dimension} och ${till.dimension}).`,
    );
  }

  // Ett tal i perPackage duger bara när en enda förpackningsenhet är inblandad.
  const ensam = forpackningsenheterI(fran, till).length <= 1;
  const franFaktor = faktorTillHuvudenhet(fran, alternativ?.perPackage, ensam);
  const tillFaktor = faktorTillHuvudenhet(till, alternativ?.perPackage, ensam);
  if (franFaktor === undefined || tillFaktor === undefined) return BEHOVER_PERPACKAGE;

  const huvud = HUVUDENHET[fran.dimension];
  const iHuvudenhet = value * franFaktor;
  const resultat = iHuvudenhet / tillFaktor;

  const steps: Steg[] = [];
  if (fran.namn === till.namn) {
    steps.push({
      nr: 1,
      etikett: 'Samma enhet',
      uttryck: formatMangd(value, fran.namn),
      resultat: formatMangd(resultat, till.namn),
    });
  } else {
    if (fran.namn !== huvud) {
      steps.push({
        nr: steps.length + 1,
        etikett: `Till ${huvud}`,
        uttryck: `${formatTal(value)} × ${formatTal(franFaktor)}`,
        resultat: formatMangd(iHuvudenhet, huvud),
      });
    }
    steps.push({
      nr: steps.length + 1,
      etikett: `Till ${till.namn}`,
      uttryck: `${formatTal(iHuvudenhet)} ÷ ${formatTal(tillFaktor)}`,
      resultat: formatMangd(resultat, till.namn),
    });
  }

  return { value: resultat, unit: till.namn, steps, formatted: formatTal(resultat), betydelse: `Omräknat till ${till.namn}` };
}

/**
 * Räknar en mängd till huvudenheten för sin dimension. Internt hjälpmedel.
 * Svarar `{ needs: 'perPackage' }` när enheten är en förpackning utan storlek.
 */
export function tillHuvudenhet(
  mangd: Mangd,
  perPackage?: PerPackage,
): { value: number; unit: string } | Behov {
  const enhet = slaUppEnhet(mangd.unit);
  kravTal(mangd.value, 'Värdet');
  const faktor = faktorTillHuvudenhet(enhet, perPackage);
  if (faktor === undefined) return BEHOVER_PERPACKAGE;
  return { value: mangd.value * faktor, unit: HUVUDENHET[enhet.dimension] };
}
