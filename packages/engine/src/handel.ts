/**
 * De fem sista räknesätten: rabatter, baklänges från ett mål, återkommande
 * kostnader, resekostnad och antal sålda för break-even.
 *
 * Ren TypeScript, inga beroenden. Avrundning enligt F01: det exakta talet
 * ligger i `value`, och när bara ett heltal duger — man kan inte sälja 11,5
 * varor — bär `value` det avrundade och `exakt` det exakta med skälet.
 */

import { stegdecimaler, valutasteg } from './avrundning.ts';
import { formatMangd, formatTal } from './format.ts';
import { RaknefelError, type Faktum, type Rad, type Resultat, type Steg } from './typer.ts';

function kravTal(varde: number, vad: string): number {
  if (typeof varde !== 'number' || !Number.isFinite(varde)) {
    throw new RaknefelError('ogiltigt-tal', `${vad} måste vara ett tal.`);
  }
  return varde;
}

function kravPositivt(varde: number, vad: string): number {
  kravTal(varde, vad);
  if (varde <= 0) {
    throw new RaknefelError('ogiltigt-tal', `${vad} måste vara större än noll.`);
  }
  return varde;
}

/** Pengar skrivs med valutans steg, oftast två decimaler. */
function pengar(varde: number, valuta: string): string {
  return formatTal(varde, stegdecimaler(valutasteg(valuta)));
}

// ---------------------------------------------------------------------------
// 1. Rabatter
// ---------------------------------------------------------------------------

export interface DiscountAlternativ {
  readonly valuta?: string;
  /**
   * Rabatterna i ordning. Procent när `sort` är 'procent', annars kronor.
   * Flera rabatter räknas EFTER varandra, inte ihopslagna: 20 % och sedan
   * 10 % är 28 %, inte 30 %.
   */
  readonly rabatter?: readonly number[];
  readonly sort?: 'procent' | 'kronor';
  /** "3 för 2": man får `far` varor och betalar för `betalar`. */
  readonly far?: number;
  readonly betalar?: number;
}

/**
 * Priset efter rabatt, och vad man sparar.
 *
 * Tre slag av rabatt, som går att kombinera:
 *   discount(500, { rabatter: [20] })                  → 400 kr
 *   discount(500, { rabatter: [20, 10] })              → 360 kr
 *   discount(500, { rabatter: [50], sort: 'kronor' })  → 450 kr
 *   discount(100, { far: 3, betalar: 2 })              → 66,67 kr per styck
 */
export function discount(pris: number, alternativ?: DiscountAlternativ): Resultat {
  kravPositivt(pris, 'Priset');
  const valuta = alternativ?.valuta ?? 'kr';
  const sort = alternativ?.sort ?? 'procent';
  const rabatter = (alternativ?.rabatter ?? []).filter((r) => Number.isFinite(r) && r > 0);
  const far = alternativ?.far;
  const betalar = alternativ?.betalar;
  const harErbjudande = far !== undefined && betalar !== undefined && far > 0 && betalar > 0;

  if (rabatter.length === 0 && !harErbjudande) {
    throw new RaknefelError(
      'ogiltigt-uttryck',
      'Det står ingen rabatt i frågan, så det finns inget att räkna av.',
    );
  }
  if (harErbjudande && betalar > far) {
    throw new RaknefelError(
      'ogiltigt-tal',
      `Ett erbjudande där man betalar för ${formatTal(betalar)} och får ${formatTal(far)} är ingen rabatt.`,
    );
  }

  const steps: Steg[] = [];
  const rader: Rad[] = [];
  let kvar = pris;

  for (const [i, rabatt] of rabatter.entries()) {
    const fore = kvar;
    if (sort === 'procent') {
      if (rabatt > 100) {
        throw new RaknefelError('ogiltigt-tal', 'En rabatt över 100 % finns inte.');
      }
      kvar = fore * (1 - rabatt / 100);
      steps.push({
        nr: steps.length + 1,
        etikett: `Rabatt ${formatTal(rabatt)} %`,
        uttryck: `${pengar(fore, valuta)} − ${formatTal(rabatt)} %`,
        resultat: `${pengar(kvar, valuta)} ${valuta}`,
      });
    } else {
      kvar = fore - rabatt;
      if (kvar < 0) {
        throw new RaknefelError(
          'negativ-kvarvarande',
          `Rabatten ${pengar(rabatt, valuta)} ${valuta} är större än priset ${pengar(fore, valuta)} ${valuta}.`,
        );
      }
      steps.push({
        nr: steps.length + 1,
        etikett: 'Rabatt',
        uttryck: `${pengar(fore, valuta)} − ${pengar(rabatt, valuta)} ${valuta}`,
        resultat: `${pengar(kvar, valuta)} ${valuta}`,
      });
    }
    rader.push({
      etikett: `Efter rabatt ${formatTal(i + 1)}`,
      formatted: pengar(kvar, valuta),
      unit: valuta,
      value: kvar,
    });
  }

  // "3 för 2" slår på styckpriset: man betalar för färre än man får.
  let styckpris: number | null = null;
  if (harErbjudande) {
    styckpris = (kvar * betalar) / far;
    steps.push({
      nr: steps.length + 1,
      etikett: `${formatTal(far)} för ${formatTal(betalar)}`,
      uttryck: `${pengar(kvar, valuta)} × ${formatTal(betalar)} ÷ ${formatTal(far)}`,
      resultat: `${pengar(styckpris, valuta)} ${valuta}/st`,
    });
    rader.push({
      etikett: `Pris per styck vid ${formatTal(far)} för ${formatTal(betalar)}`,
      formatted: pengar(styckpris, valuta),
      unit: `${valuta}/st`,
      value: styckpris,
    });
  }

  const svar = styckpris ?? kvar;
  const jamfor = styckpris === null ? pris : pris;
  const sparat = jamfor - svar;
  const sparatProcent = jamfor === 0 ? 0 : (sparat / jamfor) * 100;

  steps.push({
    nr: steps.length + 1,
    etikett: 'Du sparar',
    uttryck: `${pengar(jamfor, valuta)} − ${pengar(svar, valuta)} ${valuta}`,
    resultat: `${pengar(sparat, valuta)} ${valuta} (${formatTal(sparatProcent, 1)} %)`,
  });

  const fakta: Faktum[] = [
    {
      nyckel: 'pris',
      betydelse: 'Ordinarie pris',
      value: pris,
      formatted: pengar(pris, valuta),
      unit: valuta,
    },
    {
      nyckel: 'rabatt',
      betydelse: 'Rabatt i procent',
      value: sparatProcent,
      formatted: formatTal(sparatProcent, 1),
      unit: '%',
    },
    {
      nyckel: 'sparat',
      betydelse: 'Du sparar',
      value: sparat,
      formatted: pengar(sparat, valuta),
      unit: valuta,
    },
    {
      nyckel: 'resultat',
      betydelse: styckpris === null ? 'Pris efter rabatt' : 'Pris per styck',
      value: svar,
      formatted: pengar(svar, valuta),
      unit: styckpris === null ? valuta : `${valuta}/st`,
    },
  ];

  return {
    value: svar,
    unit: styckpris === null ? valuta : `${valuta}/st`,
    formatted: pengar(svar, valuta),
    betydelse: styckpris === null ? 'Pris efter rabatt' : 'Pris per styck efter erbjudandet',
    steps,
    villkor: [
      `Du sparar ${pengar(sparat, valuta)} ${valuta}, alltså ${formatTal(sparatProcent, 1)} %`,
      ...(rabatter.length > 1 ? ['Rabatterna räknas efter varandra, inte ihopslagna'] : []),
    ],
    ...(rader.length > 1 ? { rader } : {}),
    fakta,
  };
}

// ---------------------------------------------------------------------------
// 2a. Baklänges: priset som ger ett mål
// ---------------------------------------------------------------------------

/**
 * Försäljningspriset som ger önskad vinst eller marginal.
 *
 * `mal` är kronor när `sort` är 'vinst' och procent när den är 'marginal'.
 * Marginalen räknas på försäljningspriset, som i resten av appen — påslag och
 * marginal är inte samma sak.
 */
export function priceForTarget(
  inkop: number,
  mal: number,
  sort: 'vinst' | 'marginal',
  valuta = 'kr',
): Resultat {
  kravPositivt(inkop, 'Inköpspriset');
  kravPositivt(mal, sort === 'vinst' ? 'Vinsten' : 'Marginalen');
  if (sort === 'marginal' && mal >= 100) {
    throw new RaknefelError(
      'ogiltigt-tal',
      'En marginal på 100 % eller mer går inte: priset skulle bli oändligt.',
    );
  }

  const pris = sort === 'vinst' ? inkop + mal : inkop / (1 - mal / 100);
  const vinst = pris - inkop;
  const marginal = pris === 0 ? 0 : (vinst / pris) * 100;

  const steps: Steg[] = [
    sort === 'vinst'
      ? {
          nr: 1,
          etikett: 'Pris',
          uttryck: `${pengar(inkop, valuta)} + ${pengar(mal, valuta)} ${valuta}`,
          resultat: `${pengar(pris, valuta)} ${valuta}`,
        }
      : {
          nr: 1,
          etikett: 'Pris',
          uttryck: `${pengar(inkop, valuta)} ÷ (1 − ${formatTal(mal)} %)`,
          resultat: `${pengar(pris, valuta)} ${valuta}`,
        },
    {
      nr: 2,
      etikett: 'Vinst',
      uttryck: `${pengar(pris, valuta)} − ${pengar(inkop, valuta)} ${valuta}`,
      resultat: `${pengar(vinst, valuta)} ${valuta}`,
    },
  ];

  const fakta: Faktum[] = [
    {
      nyckel: 'inkop',
      betydelse: 'Inköpspris',
      value: inkop,
      formatted: pengar(inkop, valuta),
      unit: valuta,
    },
    {
      nyckel: 'marginal',
      betydelse: 'Marginal',
      value: marginal,
      formatted: formatTal(marginal, 1),
      unit: '%',
    },
    {
      nyckel: 'mal',
      betydelse: sort === 'vinst' ? 'Vinst per sålt' : 'Önskad marginal',
      value: sort === 'vinst' ? vinst : mal,
      formatted: sort === 'vinst' ? pengar(vinst, valuta) : formatTal(mal, 1),
      unit: sort === 'vinst' ? valuta : '%',
    },
    {
      nyckel: 'resultat',
      betydelse: 'Försäljningspris',
      value: pris,
      formatted: pengar(pris, valuta),
      unit: valuta,
    },
  ];

  return {
    value: pris,
    unit: valuta,
    formatted: pengar(pris, valuta),
    betydelse: 'Försäljningspris',
    steps,
    villkor: [
      sort === 'vinst'
        ? `Ger ${pengar(vinst, valuta)} ${valuta} i vinst, alltså ${formatTal(marginal, 1)} % marginal`
        : `Ger ${pengar(vinst, valuta)} ${valuta} i vinst per sålt`,
      'Före moms och andra kostnader än inköpet',
    ],
    fakta,
  };
}

// ---------------------------------------------------------------------------
// 2b. Baklänges: spara till ett mål
// ---------------------------------------------------------------------------

export interface SavingsPlanAlternativ {
  readonly valuta?: string;
  /** Antal månader, när frågan säger det rakt ut. */
  readonly manader?: number;
  /** Datumet målet ska vara nått, "2027-06-01". Räknas om till månader. */
  readonly datum?: string;
  /** Vad som redan är sparat. */
  readonly redan?: number;
  /** Dagens datum. Bara tester sätter den. */
  readonly idag?: Date;
}

/** Hela månader mellan två datum, avrundat uppåt — en halv månad räcker inte. */
function manaderTill(idag: Date, datum: string): number {
  const traff = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/u.exec(datum.trim());
  if (traff === null) {
    throw new RaknefelError(
      'ogiltigt-uttryck',
      `"${datum}" är inget datum jag kan räkna på. Skriv det som 2027-06-01.`,
    );
  }
  const ar = Number(traff[1]);
  const manad = Number(traff[2]);
  const dag = traff[3] === undefined ? 1 : Number(traff[3]);
  if (manad < 1 || manad > 12 || dag < 1 || dag > 31) {
    throw new RaknefelError('ogiltigt-uttryck', `"${datum}" är inget datum som finns.`);
  }
  const mal = new Date(Date.UTC(ar, manad - 1, dag));
  const nu = new Date(Date.UTC(idag.getUTCFullYear(), idag.getUTCMonth(), idag.getUTCDate()));
  if (mal.getTime() <= nu.getTime()) {
    throw new RaknefelError(
      'ogiltigt-tal',
      'Datumet har redan varit, så det finns ingen tid att spara på.',
    );
  }
  const dagar = (mal.getTime() - nu.getTime()) / 86_400_000;
  return Math.max(1, Math.ceil(dagar / 30.44));
}

/**
 * Hur mycket man måste spara per månad för att nå ett belopp.
 *
 * Beloppet per månad avrundas UPPÅT till valutans steg (F01): sparar man det
 * exakta talet nedåt saknas några kronor på slutet. Det exakta talet ligger i
 * `exakt`.
 */
export function savingsPlan(mal: number, alternativ?: SavingsPlanAlternativ): Resultat {
  kravPositivt(mal, 'Målbeloppet');
  const valuta = alternativ?.valuta ?? 'kr';
  const redan = Math.max(0, alternativ?.redan ?? 0);
  const kvar = mal - redan;
  if (kvar <= 0) {
    throw new RaknefelError(
      'ogiltigt-tal',
      `Du har redan ${pengar(redan, valuta)} ${valuta}, alltså hela målet.`,
    );
  }

  const manader =
    alternativ?.manader !== undefined && alternativ.manader > 0
      ? Math.trunc(alternativ.manader)
      : alternativ?.datum !== undefined
        ? manaderTill(alternativ.idag ?? new Date(), alternativ.datum)
        : 0;
  if (manader <= 0) {
    throw new RaknefelError(
      'ogiltigt-tal',
      'Utan antal månader eller ett datum går sparandet inte att fördela.',
    );
  }

  const exakt = kvar / manader;
  const steg = valutasteg(valuta);
  const perManad = Math.ceil(exakt / steg - 1e-9) * steg;

  const steps: Steg[] = [];
  if (redan > 0) {
    steps.push({
      nr: 1,
      etikett: 'Kvar att spara',
      uttryck: `${pengar(mal, valuta)} − ${pengar(redan, valuta)} ${valuta}`,
      resultat: `${pengar(kvar, valuta)} ${valuta}`,
    });
  }
  steps.push({
    nr: steps.length + 1,
    etikett: 'Per månad',
    uttryck: `${pengar(kvar, valuta)} ÷ ${formatTal(manader)}`,
    resultat: `${pengar(exakt, valuta)} ${valuta}`,
  });

  const fakta: Faktum[] = [
    { nyckel: 'mal', betydelse: 'Mål', value: mal, formatted: pengar(mal, valuta), unit: valuta },
    {
      nyckel: 'period',
      betydelse: 'Antal månader',
      value: manader,
      formatted: formatTal(manader),
      unit: 'mån',
    },
    {
      nyckel: 'resultat',
      betydelse: 'Att spara per månad',
      value: perManad,
      formatted: pengar(perManad, valuta),
      unit: `${valuta}/mån`,
    },
  ];
  if (redan > 0) {
    fakta.splice(1, 0, {
      nyckel: 'belopp',
      betydelse: 'Redan sparat',
      value: redan,
      formatted: pengar(redan, valuta),
      unit: valuta,
    });
  }

  return {
    value: perManad,
    unit: `${valuta}/mån`,
    formatted: pengar(perManad, valuta),
    betydelse: 'Att spara per månad',
    steps,
    villkor: [
      `${formatTal(manader)} månader till målet`,
      ...(redan > 0 ? [`${pengar(redan, valuta)} ${valuta} är redan sparat`] : []),
    ],
    fakta,
    ...(Math.abs(perManad - exakt) > steg / 1000
      ? {
          exakt: {
            value: exakt,
            formatted: pengar(exakt, valuta),
            unit: `${valuta}/mån`,
            skal: 'Avrundat uppåt, så att hela målet är nått sista månaden.',
          },
        }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// 3. Återkommande kostnader
// ---------------------------------------------------------------------------

export type Period = 'dag' | 'vecka' | 'manad' | 'ar';

/**
 * Hur många av perioden som går på ett år.
 *
 * Ett år är 365 dagar och 12 månader. Då är en vecka 365/7 av ett år, inte
 * 1/52: med 52 blev året 364 dagar långt i veckor och 365 dagar långt i
 * dagar, och då sa appen emot sig själv. Uppmätt i direktiv 35: 250 kr i
 * veckan gav 13 000 kr/år medan 35,71 kr om dagen — samma pengar — gav
 * 13 035,71 kr/år. En månad är av samma skäl 365/12 = 30,42 dagar, inte 30.
 *
 * Omräkningen går alltid via året, så varje par av perioder blir konsekvent.
 */
const PER_AR: Readonly<Record<Period, number>> = {
  dag: 365,
  vecka: 365 / 7,
  manad: 12,
  ar: 1,
};

const PERIODNAMN: Readonly<Record<Period, string>> = {
  dag: 'dag',
  vecka: 'vecka',
  manad: 'månad',
  ar: 'år',
};

export interface Kostnad {
  readonly belopp: number;
  readonly period: Period;
  readonly namn?: string;
}

/**
 * Återkommande kostnader omräknade till en period och summerade.
 *
 * recurringCost([{ belopp: 99, period: 'manad' }, { belopp: 1200, period: 'ar' }], 'ar')
 *   → 2 388 kr/år
 */
export function recurringCost(
  poster: readonly Kostnad[],
  till: Period,
  valuta = 'kr',
): Resultat {
  if (poster.length === 0) {
    throw new RaknefelError('ogiltigt-uttryck', 'Det finns ingen kostnad att räkna om.');
  }
  const rader: Rad[] = [];
  const steps: Steg[] = [];
  let summa = 0;

  for (const [i, post] of poster.entries()) {
    kravTal(post.belopp, 'Beloppet');
    if (post.belopp < 0) {
      throw new RaknefelError('ogiltigt-tal', 'En kostnad kan inte vara negativ.');
    }
    const namn = post.namn ?? `Kostnad ${formatTal(i + 1)}`;
    // Via år: beloppet per år delat på hur många av målperioden som går på ett år.
    const perAr = post.belopp * PER_AR[post.period];
    const omraknad = perAr / PER_AR[till];
    summa += omraknad;
    rader.push({
      etikett: `${namn}: ${pengar(post.belopp, valuta)} ${valuta} per ${PERIODNAMN[post.period]}`,
      formatted: pengar(omraknad, valuta),
      unit: `${valuta}/${PERIODNAMN[till]}`,
      value: omraknad,
    });
    steps.push({
      nr: i + 1,
      etikett: namn,
      uttryck:
        post.period === till
          ? `${pengar(post.belopp, valuta)} ${valuta} per ${PERIODNAMN[till]}`
          : `${pengar(post.belopp, valuta)} ${valuta} × ${formatTal(PER_AR[post.period])} ÷ ${formatTal(PER_AR[till])}`,
      resultat: `${pengar(omraknad, valuta)} ${valuta}/${PERIODNAMN[till]}`,
    });
  }

  if (poster.length > 1) {
    steps.push({
      nr: steps.length + 1,
      etikett: 'Summa',
      uttryck: rader.map((r) => r.formatted).join(' + '),
      resultat: `${pengar(summa, valuta)} ${valuta}/${PERIODNAMN[till]}`,
    });
  }

  const fakta: Faktum[] = [
    {
      nyckel: 'antal',
      betydelse: 'Antal kostnader',
      value: poster.length,
      formatted: formatTal(poster.length),
      unit: 'st',
    },
    {
      nyckel: 'period',
      betydelse: 'Period',
      value: PER_AR[till],
      formatted: PERIODNAMN[till],
      unit: '',
    },
    {
      nyckel: 'resultat',
      betydelse: `Summa per ${PERIODNAMN[till]}`,
      value: summa,
      formatted: pengar(summa, valuta),
      unit: `${valuta}/${PERIODNAMN[till]}`,
    },
  ];

  return {
    value: summa,
    unit: `${valuta}/${PERIODNAMN[till]}`,
    formatted: pengar(summa, valuta),
    betydelse: `Summa per ${PERIODNAMN[till]}`,
    steps,
    villkor: ['Räknat med 12 månader och 365 dagar på ett år, alltså 30,42 dagar i månaden'],
    ...(poster.length > 1 ? { rader } : {}),
    fakta,
  };
}

// ---------------------------------------------------------------------------
// 4. Resekostnad
// ---------------------------------------------------------------------------

export interface TripCostAlternativ {
  readonly valuta?: string;
  /** Sant när sträckan gäller en väg och resan är tur och retur. */
  readonly turOchRetur?: boolean;
  /** Hur många som delar kostnaden. 1 om ingen delar. */
  readonly personer?: number;
  /** Bränslets enhet: "l" eller "kWh". Bara för texten. */
  readonly enhet?: string;
}

/**
 * Vad en resa kostar i bränsle eller el.
 *
 * Förbrukningen anges per 100 km, som på bilar och elbilar i Sverige.
 * `tripCost(300, 0.6, 19.5)` är 300 km, 0,6 l per 100 km — knappast en bil;
 * `tripCost(300, 6, 19.5)` är 6 l per 100 km och kostar 351 kr.
 */
export function tripCost(
  strecka: number,
  forbrukningPer100: number,
  prisPerEnhet: number,
  alternativ?: TripCostAlternativ,
): Resultat {
  kravPositivt(strecka, 'Sträckan');
  kravPositivt(forbrukningPer100, 'Förbrukningen');
  kravPositivt(prisPerEnhet, 'Priset per liter eller kWh');
  const valuta = alternativ?.valuta ?? 'kr';
  const enhet = alternativ?.enhet ?? 'l';
  const personer = Math.max(1, Math.trunc(alternativ?.personer ?? 1));
  const turOchRetur = alternativ?.turOchRetur === true;

  const total = turOchRetur ? strecka * 2 : strecka;
  const mangd = (total / 100) * forbrukningPer100;
  const kostnad = mangd * prisPerEnhet;
  const perPerson = kostnad / personer;

  const steps: Steg[] = [];
  if (turOchRetur) {
    steps.push({
      nr: 1,
      etikett: 'Tur och retur',
      uttryck: `${formatMangd(strecka, 'km')} × 2`,
      resultat: formatMangd(total, 'km'),
    });
  }
  steps.push(
    {
      nr: steps.length + 1,
      etikett: 'Förbrukning',
      uttryck: `${formatMangd(total, 'km')} ÷ 100 × ${formatTal(forbrukningPer100)}`,
      resultat: formatMangd(mangd, enhet),
    },
    {
      nr: steps.length + 2,
      etikett: 'Kostnad',
      uttryck: `${formatTal(mangd, 2)} ${enhet} × ${pengar(prisPerEnhet, valuta)} ${valuta}`,
      resultat: `${pengar(kostnad, valuta)} ${valuta}`,
    },
  );
  if (personer > 1) {
    steps.push({
      nr: steps.length + 1,
      etikett: 'Per person',
      uttryck: `${pengar(kostnad, valuta)} ÷ ${formatTal(personer)}`,
      resultat: `${pengar(perPerson, valuta)} ${valuta}`,
    });
  }

  const rader: Rad[] =
    personer > 1
      ? [
          {
            etikett: 'Hela resan',
            formatted: pengar(kostnad, valuta),
            unit: valuta,
            value: kostnad,
          },
          {
            etikett: `Per person (${formatTal(personer)})`,
            formatted: pengar(perPerson, valuta),
            unit: valuta,
            value: perPerson,
          },
        ]
      : [];

  const fakta: Faktum[] = [
    {
      nyckel: 'strecka',
      betydelse: 'Sträcka',
      value: total,
      formatted: formatTal(total),
      unit: 'km',
    },
    {
      nyckel: 'forbrukning',
      betydelse: 'Bränsle',
      value: mangd,
      formatted: formatTal(mangd, 2),
      unit: enhet,
    },
    {
      nyckel: 'pris',
      betydelse: `Pris per ${enhet}`,
      value: prisPerEnhet,
      formatted: pengar(prisPerEnhet, valuta),
      unit: valuta,
    },
    {
      nyckel: 'belopp',
      betydelse: 'Hela resan',
      value: kostnad,
      formatted: pengar(kostnad, valuta),
      unit: valuta,
    },
    {
      nyckel: 'resultat',
      betydelse: personer > 1 ? 'Per person' : 'Resan kostar',
      value: perPerson,
      formatted: pengar(perPerson, valuta),
      unit: valuta,
    },
  ];
  if (personer > 1) {
    fakta.splice(4, 0, {
      nyckel: 'personer',
      betydelse: 'Antal personer',
      value: personer,
      formatted: formatTal(personer),
      unit: 'st',
    });
  }

  return {
    value: perPerson,
    unit: valuta,
    formatted: pengar(perPerson, valuta),
    betydelse: personer > 1 ? 'Per person' : 'Resan kostar',
    steps,
    villkor: [
      turOchRetur ? `${formatMangd(total, 'km')} tur och retur` : `${formatMangd(total, 'km')}`,
      `${formatTal(forbrukningPer100)} ${enhet} per 100 km`,
      ...(personer > 1 ? [`Delat på ${formatTal(personer)}`] : []),
    ],
    ...(rader.length > 0 ? { rader } : {}),
    fakta,
  };
}

// ---------------------------------------------------------------------------
// 5. Antal sålda för break-even
// ---------------------------------------------------------------------------

/**
 * Hur många som måste säljas för att täcka de fasta kostnaderna.
 *
 * Täckningsbidraget per styck är priset minus kostnaden per styck. Är det
 * noll eller negativt går gränsen aldrig att nå, och det säger motorn i
 * stället för att svara med ett oändligt tal.
 *
 * Antalet avrundas UPPÅT (F01): en halv vara täcker ingenting. Det exakta
 * talet ligger i `exakt`.
 */
export function breakEvenUnits(
  fastaKostnader: number,
  prisPerStyck: number,
  kostnadPerStyck: number,
  valuta = 'kr',
): Resultat {
  kravPositivt(fastaKostnader, 'De fasta kostnaderna');
  kravPositivt(prisPerStyck, 'Priset per styck');
  kravTal(kostnadPerStyck, 'Kostnaden per styck');
  if (kostnadPerStyck < 0) {
    throw new RaknefelError('ogiltigt-tal', 'Kostnaden per styck kan inte vara negativ.');
  }

  const tackning = prisPerStyck - kostnadPerStyck;
  if (tackning <= 0) {
    throw new RaknefelError(
      'division-med-noll',
      `Varje vara kostar ${pengar(kostnadPerStyck, valuta)} ${valuta} och säljs för ${pengar(prisPerStyck, valuta)} ${valuta}. Då täcks de fasta kostnaderna aldrig, hur många du än säljer.`,
    );
  }

  const exakt = fastaKostnader / tackning;
  const antal = Math.ceil(exakt - 1e-9);
  const omsattning = antal * prisPerStyck;

  const steps: Steg[] = [
    {
      nr: 1,
      etikett: 'Täckningsbidrag per styck',
      uttryck: `${pengar(prisPerStyck, valuta)} − ${pengar(kostnadPerStyck, valuta)} ${valuta}`,
      resultat: `${pengar(tackning, valuta)} ${valuta}`,
    },
    {
      nr: 2,
      etikett: 'Antal',
      uttryck: `${pengar(fastaKostnader, valuta)} ÷ ${pengar(tackning, valuta)}`,
      resultat: formatTal(exakt, 2),
    },
    {
      nr: 3,
      etikett: 'Avrundat uppåt',
      uttryck: `${formatTal(exakt, 2)} → ${formatTal(antal)}`,
      resultat: `${formatTal(antal)} st`,
    },
  ];

  const fakta: Faktum[] = [
    {
      nyckel: 'belopp',
      betydelse: 'Fasta kostnader',
      value: fastaKostnader,
      formatted: pengar(fastaKostnader, valuta),
      unit: valuta,
    },
    {
      nyckel: 'pris',
      betydelse: 'Pris per styck',
      value: prisPerStyck,
      formatted: pengar(prisPerStyck, valuta),
      unit: valuta,
    },
    {
      nyckel: 'tackning',
      betydelse: 'Täckningsbidrag per styck',
      value: tackning,
      formatted: pengar(tackning, valuta),
      unit: valuta,
    },
    {
      nyckel: 'antal',
      betydelse: 'Antal att sälja',
      value: antal,
      formatted: formatTal(antal),
      unit: 'st',
    },
    {
      nyckel: 'resultat',
      betydelse: 'Antal att sälja',
      value: antal,
      formatted: formatTal(antal),
      unit: 'st',
    },
  ];

  return {
    value: antal,
    unit: 'st',
    formatted: formatTal(antal),
    betydelse: 'Antal att sälja för att gå jämnt ut',
    steps,
    villkor: [
      `Täckningsbidrag ${pengar(tackning, valuta)} ${valuta} per styck`,
      `Ger ${pengar(omsattning, valuta)} ${valuta} i omsättning`,
    ],
    fakta,
    exakt: {
      value: exakt,
      formatted: formatTal(exakt, 2),
      unit: 'st',
      skal: `En halv vara täcker ingenting, så ${formatTal(exakt, 2)} avrundas uppåt.`,
    },
  };
}
