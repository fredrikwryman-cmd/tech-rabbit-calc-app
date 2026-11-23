/**
 * Procent, moms, påslag och timpris.
 *
 * Samma regel som i resten av motorn: multiplicera före divisionen där det går,
 * så att 200 000 × 3,5 % blir 7 000 och inte 7 000,000000000001.
 */

import { praktisktVarde } from './avrundning.ts';
import { BEHOVER_TIMMAR, type Behov } from './enheter.ts';
import { formatTal } from './format.ts';
import { type Faktum, RaknefelError, type Resultat, type Steg } from './typer.ts';

function kravTal(varde: number, vad: string): number {
  if (typeof varde !== 'number' || !Number.isFinite(varde)) {
    throw new RaknefelError('ogiltigt-tal', `${vad} måste vara ett tal.`);
  }
  return varde;
}

/** Procentsatsen skriven som den står i frågan: 25 betyder 25 %. */
function kravSats(sats: number): number {
  kravTal(sats, 'Procentsatsen');
  if (sats < 0) {
    throw new RaknefelError('ogiltigt-tal', 'Procentsatsen kan inte vara negativ.');
  }
  return sats;
}

/**
 * Så många procent av ett tal.
 *
 * percentOf(25, 800)        → 200
 * percentOf(25, 800, 'kr')  → 200 kr
 */
export function percentOf(procent: number, tal: number, unit = ''): Resultat {
  kravSats(procent);
  kravTal(tal, 'Talet');

  const varde = (tal * procent) / 100;
  const steps: Steg[] = [
    {
      nr: 1,
      etikett: `${formatTal(procent)} % av ${formatTal(tal)}`,
      uttryck: `${formatTal(tal)} × ${formatTal(procent)} ÷ 100`,
      resultat: `${formatTal(varde)}${unit === '' ? '' : ` ${unit}`}`,
    },
  ];
  return {
    value: varde, unit, steps, formatted: formatTal(varde),
    betydelse: `${formatTal(procent)} % av ${formatTal(tal)}`,
  };
}

/**
 * Förändring i procent från ett tal till ett annat. Negativt när det minskat.
 *
 * percentChange(40, 65) → 62,5 %
 */
export function percentChange(fran: number, till: number): Resultat {
  kravTal(fran, 'Värdet före');
  kravTal(till, 'Värdet efter');
  if (fran === 0) {
    throw new RaknefelError(
      'division-med-noll',
      'Förändring i procent går inte att räkna från noll.',
    );
  }

  const skillnad = till - fran;
  const varde = (skillnad * 100) / fran;

  const steps: Steg[] = [
    {
      nr: 1,
      etikett: skillnad < 0 ? 'Minskning' : 'Ökning',
      uttryck: `${formatTal(till)} − ${formatTal(fran)}`,
      resultat: formatTal(skillnad),
    },
    {
      nr: 2,
      etikett: 'Andel av värdet före',
      uttryck: `${formatTal(skillnad)} ÷ ${formatTal(fran)} × 100`,
      resultat: `${formatTal(varde, 1)} %`,
    },
  ];
  return {
    value: varde, unit: '%', steps, formatted: formatTal(varde, 1),
    betydelse: skillnad < 0 ? 'Minskning i procent' : 'Ökning i procent',
    fakta: [
      { nyckel: 'ovrigt', betydelse: 'Värdet före', value: fran, formatted: formatTal(fran), unit: '' },
      { nyckel: 'ovrigt', betydelse: 'Värdet efter', value: till, formatted: formatTal(till), unit: '' },
      { nyckel: 'resultat', betydelse: 'Förändring', value: varde, formatted: formatTal(varde, 1), unit: '%' },
    ],
  };
}

/**
 * De svenska momssatserna. Andra satser går också att räkna på.
 *
 * 25 % är normalsatsen och gäller det mesta. 12 % gäller mat, restaurang och
 * hotell. 6 % gäller böcker, tidningar, persontransport och kultur.
 */
export const MOMSSATSER = [25, 12, 6] as const;

/** Normalsatsen, som används när frågan inte säger vilken sats som gäller. */
export const MOMS_NORMALSATS = 25;

export type Momsrakning =
  /** Netto → brutto. Lägg på moms. */
  | 'lagg-pa'
  /** Brutto → netto. Dra av moms: brutto ÷ (1 + sats). */
  | 'dra-av'
  /** Momsen på ett nettobelopp. */
  | 'moms-pa-netto'
  /** Momsen som redan ingår i ett bruttobelopp. */
  | 'moms-i-brutto';

/**
 * Moms.
 *
 * vat(800, 25, 'lagg-pa')       → 1 000 kr
 * vat(1000, 25, 'dra-av')       →   800 kr
 * vat(800, 25, 'moms-pa-netto') →   200 kr
 * vat(1000, 25, 'moms-i-brutto')→   200 kr
 *
 * Avdraget räknas alltid som brutto ÷ (1 + sats), aldrig som brutto minus
 * sats procent av bruttot — det senare ger fel svar.
 */
export function vat(
  belopp: number,
  sats: number,
  rakning: Momsrakning,
  valuta = 'kr',
  /**
   * Sant när satsen inte stod i frågan utan är normalsatsen 25 %. Då sägs det
   * i villkoret, och satsen märks som ändringsbar — vi antar hellre öppet än
   * frågar om något de allra flesta ändå svarar 25 på.
   */
  satsAntagen = false,
): Resultat {
  kravTal(belopp, 'Beloppet');
  kravSats(sats);

  const faktor = 1 + sats / 100;
  // Nettot raknas som belopp × 100 ÷ (100 + sats), inte belopp ÷ faktor:
  // 112 ÷ 1,12 ger 100,00000000000001 i flyttal, det forra ger 100 exakt.
  const netto = (belopp * 100) / (100 + sats);
  const steps: Steg[] = [];
  let varde: number;

  if (rakning === 'lagg-pa') {
    const moms = (belopp * sats) / 100;
    varde = belopp + moms;
    steps.push(
      {
        nr: 1,
        etikett: `Moms ${formatTal(sats)} %`,
        uttryck: `${formatTal(belopp)} × ${formatTal(sats)} ÷ 100`,
        resultat: `${formatTal(moms, 2)} ${valuta}`,
      },
      {
        nr: 2,
        etikett: 'Pris med moms',
        uttryck: `${formatTal(belopp)} + ${formatTal(moms, 2)}`,
        resultat: `${formatTal(varde, 2)} ${valuta}`,
      },
    );
  } else if (rakning === 'dra-av') {
    varde = netto;
    steps.push({
      nr: 1,
      etikett: 'Pris utan moms',
      uttryck: `${formatTal(belopp)} ÷ ${formatTal(faktor)}`,
      resultat: `${formatTal(varde, 2)} ${valuta}`,
    });
  } else if (rakning === 'moms-pa-netto') {
    varde = (belopp * sats) / 100;
    steps.push({
      nr: 1,
      etikett: `Moms ${formatTal(sats)} % på beloppet`,
      uttryck: `${formatTal(belopp)} × ${formatTal(sats)} ÷ 100`,
      resultat: `${formatTal(varde, 2)} ${valuta}`,
    });
  } else {
    varde = belopp - netto;
    steps.push(
      {
        nr: 1,
        etikett: 'Pris utan moms',
        uttryck: `${formatTal(belopp)} ÷ ${formatTal(faktor)}`,
        resultat: `${formatTal(netto, 2)} ${valuta}`,
      },
      {
        nr: 2,
        etikett: 'Momsen som ingår',
        uttryck: `${formatTal(belopp)} − ${formatTal(netto, 2)}`,
        resultat: `${formatTal(varde, 2)} ${valuta}`,
      },
    );
  }

  const betydelse =
    rakning === 'lagg-pa' ? 'Pris med moms'
      : rakning === 'dra-av' ? 'Pris utan moms'
        : 'Momsbelopp';
  const medMoms = rakning === 'dra-av' || rakning === 'moms-i-brutto';

  return {
    value: varde, unit: valuta, steps, formatted: formatTal(varde, 2),
    betydelse,
    villkor: [
      satsAntagen
        ? `Med ${formatTal(sats)} % moms, normalsatsen`
        : `Med ${formatTal(sats)} % moms`,
    ],
    ...(satsAntagen ? { andringsbart: ['moms' as const] } : {}),
    fakta: [
      {
        nyckel: medMoms ? 'brutto' : 'netto',
        betydelse: medMoms ? 'Belopp med moms' : 'Belopp utan moms',
        value: belopp, formatted: formatTal(belopp), unit: valuta,
      },
      {
        nyckel: 'moms',
        betydelse: satsAntagen ? 'Momssats (normalsatsen)' : 'Momssats',
        value: sats, formatted: formatTal(sats), unit: '%',
      },
      { nyckel: 'resultat', betydelse, value: varde, formatted: formatTal(varde, 2), unit: valuta },
    ],
  };
}

/**
 * Påslag på ett inköpspris, och vilken marginal påslaget ger.
 *
 * Påslag och marginal är inte samma tal, och det är den vanligaste
 * förväxlingen i branschen: 50 % påslag ger 33,3 % marginal. Därför visas
 * marginalen som ett eget steg.
 *
 * markup(40, 50) → 60 kr, marginal 33,3 %
 */
export function markup(inkop: number, paslagProcent: number, valuta = 'kr'): Resultat {
  kravTal(inkop, 'Inköpspriset');
  kravSats(paslagProcent);

  const paslag = (inkop * paslagProcent) / 100;
  const pris = inkop + paslag;

  const steps: Steg[] = [
    {
      nr: 1,
      etikett: `Påslag ${formatTal(paslagProcent)} %`,
      uttryck: `${formatTal(inkop)} × ${formatTal(paslagProcent)} ÷ 100`,
      resultat: `${formatTal(paslag, 2)} ${valuta}`,
    },
    {
      nr: 2,
      etikett: 'Försäljningspris',
      uttryck: `${formatTal(inkop)} + ${formatTal(paslag, 2)}`,
      resultat: `${formatTal(pris, 2)} ${valuta}`,
    },
  ];

  // Marginalen är andelen av försäljningspriset, inte av inköpet.
  if (pris !== 0) {
    const marginal = (paslag * 100) / pris;
    steps.push({
      nr: 3,
      etikett: 'Marginalen det ger',
      uttryck: `${formatTal(paslag, 2)} ÷ ${formatTal(pris, 2)} × 100`,
      resultat: `${formatTal(marginal, 1)} %`,
    });
  }

  const marginal = pris === 0 ? 0 : (paslag * 100) / pris;
  const praktisktPris = praktisktVarde(pris, 'minsta-pris', { unit: valuta, valuta });
  const fakta: Faktum[] = [
    { nyckel: 'inkop', betydelse: 'Inköpspris', value: inkop, formatted: formatTal(inkop), unit: valuta },
    { nyckel: 'paslag', betydelse: 'Påslag', value: paslagProcent, formatted: formatTal(paslagProcent), unit: '%' },
    { nyckel: 'marginal', betydelse: 'Marginal', value: marginal, formatted: formatTal(marginal, 1), unit: '%' },
    { nyckel: 'resultat', betydelse: 'Försäljningspris', value: pris, formatted: formatTal(pris, 2), unit: valuta },
  ];
  return {
    value: pris, unit: valuta, steps, formatted: formatTal(pris, 2),
    betydelse: 'Försäljningspris',
    villkor: [`${formatTal(paslagProcent)} % påslag på inköpet`],
    ...(praktisktPris ? { praktiskt: praktisktPris } : {}),
    fakta,
  };
}

/**
 * Försäljningspris ur en önskad marginal.
 *
 * Marginal och påslag är inte samma sak, och förväxlingen är dyr: 80 kr med
 * 30 % PÅSLAG blir 104 kr, men 80 kr med 30 % MARGINAL blir 114,29 kr.
 * Priset räknas som inköp ÷ (1 − marginal) och avrundas uppåt, så att
 * marginalen verkligen uppnås.
 *
 * priceFromMargin(80, 30) → 114,29 kr
 */
export function priceFromMargin(
  inkop: number,
  marginalProcent: number,
  valuta = 'kr',
): Resultat {
  kravTal(inkop, 'Inköpspriset');
  kravSats(marginalProcent);
  if (marginalProcent >= 100) {
    throw new RaknefelError(
      'ogiltigt-tal',
      'En marginal på 100 % eller mer går inte att räkna ett pris ur.',
    );
  }

  const andel = (100 - marginalProcent) / 100;
  const pris = inkop / andel;
  const paslagProcent = inkop === 0 ? 0 : ((pris - inkop) * 100) / inkop;

  const steps: Steg[] = [
    {
      nr: 1,
      etikett: 'Andel som är inköp',
      uttryck: `100 % − ${formatTal(marginalProcent)} %`,
      resultat: `${formatTal(100 - marginalProcent)} %`,
    },
    {
      nr: 2,
      etikett: 'Försäljningspris',
      uttryck: `${formatTal(inkop)} ÷ ${formatTal(andel)}`,
      resultat: `${formatTal(pris, 2)} ${valuta}`,
    },
  ];

  const praktisktPris = praktisktVarde(pris, 'minsta-pris', { unit: valuta, valuta });

  return {
    value: pris, unit: valuta, steps, formatted: formatTal(pris, 2),
    betydelse: 'Försäljningspris',
    villkor: [`${formatTal(marginalProcent)} % marginal`, 'bara inköpet är medräknat'],
    ...(praktisktPris ? { praktiskt: praktisktPris } : {}),
    fakta: [
      { nyckel: 'inkop', betydelse: 'Inköpspris', value: inkop, formatted: formatTal(inkop), unit: valuta },
      { nyckel: 'marginal', betydelse: 'Marginal', value: marginalProcent, formatted: formatTal(marginalProcent), unit: '%' },
      { nyckel: 'paslag', betydelse: 'Påslag', value: paslagProcent, formatted: formatTal(paslagProcent, 1), unit: '%' },
      { nyckel: 'resultat', betydelse: 'Försäljningspris', value: pris, formatted: formatTal(pris, 2), unit: valuta },
    ],
  };
}

/**
 * Timpris ur ett månadsmål.
 *
 * Saknas antalet timmar gissar motorn aldrig — en månad är inte ett bestämt
 * antal arbetstimmar. Då svarar den `{ needs: 'timmar' }` och appen frågar.
 *
 * hourlyRate(40000, 160) → 250 kr/h
 * hourlyRate(40000)      → { needs: 'timmar' }
 */
export function hourlyRate(
  manadsmal: number,
  timmarPerManad?: number,
  valuta = 'kr',
): Resultat | Behov {
  kravTal(manadsmal, 'Månadsmålet');

  if (
    timmarPerManad === undefined ||
    !Number.isFinite(timmarPerManad) ||
    timmarPerManad <= 0
  ) {
    return BEHOVER_TIMMAR;
  }

  const varde = manadsmal / timmarPerManad;
  const enhet = `${valuta}/h`;
  const steps: Steg[] = [
    {
      nr: 1,
      etikett: 'Timpris',
      uttryck: `${formatTal(manadsmal)} ÷ ${formatTal(timmarPerManad)} h`,
      resultat: `${formatTal(varde, 2)} ${enhet}`,
    },
  ];
  return {
    value: varde, unit: enhet, steps, formatted: formatTal(varde, 2),
    betydelse: 'Timpris',
    villkor: ['räknat på debiterbara timmar', 'före skatt och kostnader'],
    fakta: [
      { nyckel: 'belopp', betydelse: 'Månadsmål', value: manadsmal, formatted: formatTal(manadsmal), unit: valuta },
      { nyckel: 'timmar', betydelse: 'Debiterbara timmar', value: timmarPerManad, formatted: formatTal(timmarPerManad), unit: 'h' },
      { nyckel: 'resultat', betydelse: 'Timpris', value: varde, formatted: formatTal(varde, 2), unit: enhet },
    ],
  };
}
