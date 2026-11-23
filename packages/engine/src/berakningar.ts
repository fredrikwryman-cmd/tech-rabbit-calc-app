import {
  type Faktum,
  type Mangd,
  type Rad,
  type Resultat,
  type Steg,
  RaknefelError,
} from './typer.ts';
import {
  type Behov,
  BEHOVER_PERPACKAGE,
  faktorTillHuvudenhet,
  forpackningsenheterI,
  HUVUDENHET,
  type PerPackage,
  slaUppEnhet,
} from './enheter.ts';
import { praktisktVarde } from './avrundning.ts';
import { formatMangd, formatTal } from './format.ts';
import { convert } from './konvertera.ts';

/** En mängd, eller ett tal som ska läsas i en given enhet. */
export type MangdEllerTal = Mangd | number;

export interface BreakEvenAlternativ {
  /** Valutan som visas i enheten. Standard "kr". */
  readonly valuta?: string;
  /**
   * Hur många styck en förpackning rymmer. Krävs så fort pkt, låda eller pall
   * är med. Saknas den svarar breakEven `{ needs: 'perPackage' }`.
   */
  readonly perPackage?: PerPackage;
  /**
   * Förpackningsstorlekar att prissätta, uttryckta i svarets enhet.
   *
   * `[5, 10]` med svaret i kr/g ger ett pris för en 5-gramsförpackning och ett
   * för en 10-gramsförpackning, som rader under huvudtalet. Priset räknas på
   * det exakta styckpriset, aldrig på det avrundade: 5 000 ÷ 750 × 5 blir
   * 33,33 och inte 33,35.
   */
  readonly forpackningar?: readonly number[];
  /**
   * Sant när hela resten säljs på en gång. Då blir totalpriset huvudsvaret
   * och styckpriset en rad under — "sälja allt på en gång" betyder att det
   * är klumpsumman man vill veta.
   */
  readonly helaPartiet?: boolean;
}

function somMangd(varde: MangdEllerTal, reservEnhet: string, vad: string): Mangd {
  if (typeof varde === 'number') {
    if (!Number.isFinite(varde)) {
      throw new RaknefelError('ogiltigt-tal', `${vad} måste vara ett tal.`);
    }
    return { value: varde, unit: reservEnhet };
  }
  if (!varde || typeof varde.value !== 'number' || !Number.isFinite(varde.value)) {
    throw new RaknefelError('ogiltigt-tal', `${vad} måste vara ett tal.`);
  }
  return varde;
}

/**
 * Vad en vara kostar per enhet när en del redan är förbrukad.
 *
 * breakEven(12, { value: 1, unit: 'kg' }, { value: 300, unit: 'g' })
 *   → 17,14 kr/kg
 *
 * Är någon enhet en förpackning (pkt, låda, pall) krävs `perPackage`.
 * Utan den svarar funktionen `{ needs: 'perPackage' }`, eftersom förpackningar
 * inte har någon fast storlek.
 *
 * @param cost      vad hela mängden kostade
 * @param quantity  hela mängden
 * @param consumed  det som gått åt, i vilken enhet som helst i samma dimension
 * @param unit      enheten svaret ska visas i. Utan värde: dimensionens
 *                  huvudenhet (vikt kg, volym l, längd m, yta m², tid s, antal st).
 */
export function breakEven(
  cost: number,
  quantity: MangdEllerTal,
  consumed: MangdEllerTal,
  unit?: string,
  alternativ?: BreakEvenAlternativ,
): Resultat | Behov {
  if (!Number.isFinite(cost)) {
    throw new RaknefelError('ogiltigt-tal', 'Kostnaden måste vara ett tal.');
  }
  const valuta = alternativ?.valuta ?? 'kr';
  const perPackage = alternativ?.perPackage;

  const mangd = somMangd(quantity, unit ?? 'st', 'Mängden');
  const forbrukat = somMangd(consumed, unit ?? mangd.unit, 'Det förbrukade');

  const mangdEnhet = slaUppEnhet(mangd.unit);
  const forbrukatEnhet = slaUppEnhet(forbrukat.unit);
  if (mangdEnhet.dimension !== forbrukatEnhet.dimension) {
    throw new RaknefelError(
      'olika-dimensioner',
      `${mangdEnhet.namn} och ${forbrukatEnhet.namn} mäter inte samma sak.`,
    );
  }

  // Svaret visas i begärd enhet, annars i dimensionens huvudenhet.
  const utEnhetNamn = unit ?? HUVUDENHET[mangdEnhet.dimension];
  const utEnhet = slaUppEnhet(utEnhetNamn);
  if (utEnhet.dimension !== mangdEnhet.dimension) {
    throw new RaknefelError(
      'olika-dimensioner',
      `Svaret kan inte visas i ${utEnhet.namn} när mängden är i ${mangdEnhet.namn}.`,
    );
  }
  // Ett tal i perPackage duger bara när en enda förpackningsenhet är med.
  const ensam = forpackningsenheterI(mangdEnhet, forbrukatEnhet, utEnhet).length <= 1;
  const utFaktor = faktorTillHuvudenhet(utEnhet, perPackage, ensam);
  const mangdFaktor = faktorTillHuvudenhet(mangdEnhet, perPackage, ensam);
  const forbrukatFaktor = faktorTillHuvudenhet(forbrukatEnhet, perPackage, ensam);
  if (utFaktor === undefined || mangdFaktor === undefined || forbrukatFaktor === undefined) {
    return BEHOVER_PERPACKAGE;
  }

  const mangdIUt = (mangd.value * mangdFaktor) / utFaktor;
  const forbrukatIUt = (forbrukat.value * forbrukatFaktor) / utFaktor;
  const kvar = mangdIUt - forbrukatIUt;

  const steps: Steg[] = [];

  // Är mängden angiven i förpackningar visas omräkningen för sig, så att
  // "3 låda − 40 st" inte ser ut som en subtraktion av olika saker:
  //   1. 3 låda × 100 st = 300 st
  //   2. 300 st − 40 st  = 260 st
  const visaForpackning = mangdEnhet.faktor === null && mangdEnhet.namn !== utEnhet.namn;
  if (visaForpackning) {
    steps.push({
      nr: steps.length + 1,
      etikett: `Antal per ${mangdEnhet.namn}`,
      uttryck: `${formatMangd(mangd.value, mangdEnhet.namn)} × ${formatMangd(mangdFaktor / utFaktor, utEnhet.namn)}`,
      resultat: formatMangd(mangdIUt, utEnhet.namn),
    });
  }

  /**
   * Inget eget bruk betyder att frågan inte handlar om att sälja en rest.
   *
   * "Jag betalar 180 kr för 1 kg kaffe" är ett inköpspris per mängd, inte en
   * kalkyl på vad resten måste inbringa. Då är steget "1 kg − 0 kg" bara brus,
   * och villkoren om försäljning är påståenden frågan aldrig gjorde.
   */
  const egenForbrukning = forbrukatIUt > 0;

  if (egenForbrukning) {
    steps.push({
      nr: steps.length + 1,
      etikett: 'Kvar att sälja',
      uttryck: visaForpackning
        ? `${formatMangd(mangdIUt, utEnhet.namn)} − ${formatMangd(forbrukat.value, forbrukatEnhet.namn)}`
        : `${formatMangd(mangd.value, mangdEnhet.namn)} − ${formatMangd(forbrukat.value, forbrukatEnhet.namn)}`,
      resultat: formatMangd(kvar, utEnhet.namn),
    });
  }

  if (kvar === 0) {
    throw new RaknefelError(
      'division-med-noll',
      'Allt är förbrukat, så det finns inget att räkna kostnaden per enhet på.',
    );
  }
  if (kvar < 0) {
    throw new RaknefelError(
      'negativ-kvarvarande',
      'Mer är förbrukat än det fanns, så kostnaden per enhet går inte att räkna.',
    );
  }

  const varde = cost / kvar;
  const enhet = `${valuta}/${utEnhet.namn}`;
  steps.push({
    nr: steps.length + 1,
    etikett: egenForbrukning ? 'Kostnad per enhet' : 'Pris per enhet',
    uttryck: `${formatTal(cost)} ${valuta} ÷ ${formatMangd(kvar, utEnhet.namn)}`,
    resultat: `${formatTal(varde, 2)} ${enhet}`,
  });

  const betydelse = egenForbrukning
    ? `Minsta pris per ${utEnhet.namn}`
    : `Pris per ${utEnhet.namn}`;

  const fakta: Faktum[] = [
    { nyckel: 'inkop', betydelse: egenForbrukning ? 'Inköpskostnad' : 'Pris', value: cost, formatted: formatTal(cost), unit: valuta },
    { nyckel: 'mangd', betydelse: 'Hela mängden', value: mangdIUt, formatted: formatTal(mangdIUt), unit: utEnhet.namn },
    ...(egenForbrukning
      ? [
          { nyckel: 'forbrukat' as const, betydelse: 'Eget bruk', value: forbrukatIUt, formatted: formatTal(forbrukatIUt), unit: utEnhet.namn },
          { nyckel: 'kvar' as const, betydelse: 'Kvar att sälja', value: kvar, formatted: formatTal(kvar), unit: utEnhet.namn },
        ]
      : []),
    { nyckel: 'resultat', betydelse, value: varde, formatted: formatTal(varde, 2), unit: enhet },
  ];

  // F01: priset ska tacka inkopet aven efter avrundning. Bara nar det finns
  // en kostnad att tacka, alltsa nar en rest ska salja in inkopet.
  const praktiskt = egenForbrukning
    ? praktisktVarde(varde, 'minsta-pris', {
        unit: enhet,
        valuta,
        mangd: kvar,
        tacker: cost,
      })
    : null;

  /**
   * Huvudtalet när ett praktiskt pris finns.
   *
   * Målet är att täcka inköpet. 2,88 × 260 = 748,80 täcker inte 750, så
   * "minst 2,88" är fel råd. Svaret är 2,89, och 2,88 visas litet under som
   * det exakta talet.
   */
  const svarsvarde = praktiskt ? praktiskt.value : varde;
  const svarstext = praktiskt ? praktiskt.formatted : formatTal(varde, 2);

  const bas = (): Resultat => ({
    value: svarsvarde,
    unit: enhet,
    steps,
    formatted: svarstext,
    betydelse,
    ...(egenForbrukning
      ? {
          villkor: [
            `Om alla ${formatMangd(kvar, utEnhet.namn)} säljs`,
            'efter inköpskostnaden',
          ],
        }
      : {}),
    ...(praktiskt
      ? {
          exakt: {
            value: varde,
            formatted: formatTal(varde, 2),
            unit: enhet,
            skal: praktiskt.skal,
          },
        }
      : {}),
    fakta,
  });

  // Ett pris per förpackningsstorlek, som egna rader och egna steg.
  const storlekar = (alternativ?.forpackningar ?? []).filter((n) => Number.isFinite(n) && n > 0);
  if (storlekar.length > 0) {
    const rader: Rad[] = [];
    for (const storlek of storlekar) {
      const pris = varde * storlek;
      const etikett = formatMangd(storlek, utEnhet.namn);
      steps.push({
        nr: steps.length + 1,
        etikett: `Pris för ${etikett}`,
        uttryck: `${formatTal(varde, 2)} × ${formatTal(storlek)}`,
        resultat: `${formatTal(pris, 2)} ${valuta}`,
      });
      rader.push({ etikett, formatted: formatTal(pris, 2), unit: valuta, value: pris });
    }
    return { ...bas(), rader };
  }

  // Bada svarsformerna. Priset per enhet och priset for hela resten ar samma
  // rakning sedd pa tva satt, och bada ar anvandbara: det ena nar man
  // prismarker, det andra nar man saljer alltihop pa en gang.
  const styckrad: Rad = {
    etikett: `Per ${utEnhet.namn}`,
    formatted: svarstext,
    unit: enhet,
    value: svarsvarde,
  };
  const partirad: Rad = {
    etikett: `Hela resten, ${formatMangd(kvar, utEnhet.namn)}`,
    formatted: formatTal(cost, 2),
    unit: valuta,
    value: cost,
  };

  if (alternativ?.helaPartiet === true) {
    steps.push({
      nr: steps.length + 1,
      etikett: 'Hela resten på en gång',
      uttryck: `${formatTal(varde, 2)} ${enhet} × ${formatMangd(kvar, utEnhet.namn)}`,
      resultat: `${formatTal(cost, 2)} ${valuta}`,
    });
    return {
      value: cost,
      unit: valuta,
      steps,
      formatted: formatTal(cost, 2),
      betydelse: 'Minsta pris för hela resten',
      villkor: [`Om alla ${formatMangd(kvar, utEnhet.namn)} säljs på en gång`, 'efter inköpskostnaden'],
      fakta,
      rader: [styckrad],
    };
  }

  // Partiraden hör till en rest som ska säljas. Utan eget bruk finns ingen
  // rest, bara ett pris per enhet, och då är den andra raden samma tal igen.
  return egenForbrukning ? { ...bas(), rader: [partirad] } : bas();
}

/**
 * Marginalen i procent: hur stor del av försäljningspriset som är vinst.
 *
 * margin(40, 65) → 38,5 %
 */
export function margin(buy: number, sell: number): Resultat {
  if (!Number.isFinite(buy) || !Number.isFinite(sell)) {
    throw new RaknefelError('ogiltigt-tal', 'Inköp och försäljning måste vara tal.');
  }
  if (sell === 0) {
    throw new RaknefelError(
      'division-med-noll',
      'Med försäljningspriset noll finns ingen marginal att räkna.',
    );
  }

  const vinst = sell - buy;
  const varde = (vinst * 100) / sell;

  const steps: Steg[] = [
    {
      nr: 1,
      etikett: 'Bruttovinst per vara',
      uttryck: `${formatTal(sell)} − ${formatTal(buy)}`,
      resultat: `${formatTal(vinst)} kr`,
    },
    {
      nr: 2,
      etikett: 'Andel av priset',
      uttryck: `${formatTal(vinst)} ÷ ${formatTal(sell)} × 100`,
      resultat: `${formatTal(varde, 1)} %`,
    },
  ];

  return {
    value: varde,
    unit: '%',
    steps,
    formatted: formatTal(varde, 1),
    betydelse: 'Marginal',
    villkor: ['andel av försäljningspriset', 'bara inköpet är medräknat'],
    fakta: [
      { nyckel: 'inkop', betydelse: 'Inköpspris', value: buy, formatted: formatTal(buy), unit: 'kr' },
      { nyckel: 'forsaljning', betydelse: 'Försäljningspris', value: sell, formatted: formatTal(sell), unit: 'kr' },
      { nyckel: 'ovrigt', betydelse: 'Bruttovinst per vara', value: vinst, formatted: formatTal(vinst), unit: 'kr' },
      { nyckel: 'marginal', betydelse: 'Marginal', value: varde, formatted: formatTal(varde, 1), unit: '%' },
    ],
  };
}

/**
 * Enkel ränta: räntan räknas bara på beloppet, aldrig på tidigare ränta.
 *
 * interest(200000, 3.5) → 7 000 kr
 */
export function interest(principal: number, ratePercent: number, years = 1): Resultat {
  if (!Number.isFinite(principal) || !Number.isFinite(ratePercent) || !Number.isFinite(years)) {
    throw new RaknefelError('ogiltigt-tal', 'Belopp, ränta och tid måste vara tal.');
  }

  // Multiplicera före divisionen: annars ger 200 000 × (3,5 / 100) talet 7 000,000000000001.
  const perAr = (principal * ratePercent) / 100;
  const varde = perAr * years;

  const steps: Steg[] = [
    {
      nr: 1,
      etikett: 'Ränta per år',
      uttryck: `${formatTal(principal)} × ${formatTal(ratePercent)} %`,
      resultat: `${formatTal(perAr)} kr`,
    },
  ];
  if (years !== 1) {
    steps.push({
      nr: 2,
      etikett: years === 1 ? 'Ett år' : `${formatTal(years)} år`,
      uttryck: `${formatTal(perAr)} × ${formatTal(years)}`,
      resultat: `${formatTal(varde)} kr`,
    });
  }

  return {
    value: varde,
    unit: 'kr',
    steps,
    formatted: formatTal(varde),
    betydelse: years === 1 ? 'Ränta på ett år' : `Ränta på ${formatTal(years)} år`,
    villkor: ['enkel ränta', 'räntan räknas bara på beloppet'],
    fakta: [
      { nyckel: 'belopp', betydelse: 'Belopp', value: principal, formatted: formatTal(principal), unit: 'kr' },
      { nyckel: 'ranta', betydelse: 'Räntesats', value: ratePercent, formatted: formatTal(ratePercent), unit: '%' },
      { nyckel: 'resultat', betydelse: 'Ränta', value: varde, formatted: formatTal(varde), unit: 'kr' },
    ],
  };
}

export { convert };
