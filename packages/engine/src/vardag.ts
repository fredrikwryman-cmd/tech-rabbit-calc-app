/**
 * Fyra vardagliga räknesätt: vyerna 30–33 i design v4.
 *
 * - `comparePrices` (30): jämförpris per kg, l eller st, och vilken vara som
 *   är billigast — med skillnaden i både kronor och procent.
 * - `splitCost` (31): vad var och en ska betala, och vid olika utlägg vem som
 *   ska betala vem.
 * - `packages` (32): hur många förpackningar som behövs med svinn inräknat,
 *   och vad som blir över.
 * - `workTime` (33): arbetad tid per dag och i summa, och lönen när timlönen
 *   är känd.
 *
 * Ren TypeScript, inga beroenden. Avrundning enligt F01: det exakta talet
 * ligger i `value`, och när ett heltal krävs — förpackningar går inte att
 * köpa i halvor — bär `value` det avrundade och `exakt` det exakta.
 */

import { stegdecimaler, valutasteg } from './avrundning.ts';
import { HUVUDENHET, slaUppEnhet, type PerPackage } from './enheter.ts';
import { tillHuvudenhet } from './konvertera.ts';
import { formatMangd, formatTal } from './format.ts';
import { RaknefelError, type Faktum, type Rad, type Resultat, type Steg } from './typer.ts';

/** Bokstäverna personerna får när frågan inte namnger dem (vy 31). */
const BOKSTAVER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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
// 30. Jämföra pris
// ---------------------------------------------------------------------------

export interface Vara {
  /** Vad varan kostar i sin helhet. */
  readonly pris: number;
  /** Hur mycket man får, t.ex. 750 g eller 1,2 kg. */
  readonly mangd: number;
  /** Mängdens enhet. Varorna behöver inte ha samma — motorn räknar om. */
  readonly enhet: string;
  /** Namnet i svaret. Saknas det får varan A, B, C … */
  readonly namn?: string;
}

export interface ComparePricesAlternativ {
  readonly valuta?: string;
  readonly perPackage?: PerPackage;
}

/**
 * Jämför två eller fler varor och säger vilken som är billigast per enhet.
 *
 * Mängderna räknas om till dimensionens huvudenhet (kg, l, st …) innan de
 * jämförs, så att 750 g och 1,2 kg går att ställa mot varandra. Blandade
 * dimensioner går inte: ett kilo och en liter är inte samma sorts mängd.
 */
export function comparePrices(varor: readonly Vara[], alternativ?: ComparePricesAlternativ): Resultat {
  if (varor.length < 2) {
    throw new RaknefelError('ogiltigt-uttryck', 'Det behövs minst två varor att jämföra.');
  }
  const valuta = alternativ?.valuta ?? 'kr';

  const rakna = varor.map((vara, i) => {
    const namn = vara.namn ?? BOKSTAVER[i] ?? `Vara ${i + 1}`;
    kravTal(vara.pris, `Priset för ${namn}`);
    if (vara.pris < 0) {
      throw new RaknefelError('ogiltigt-tal', `Priset för ${namn} kan inte vara negativt.`);
    }
    kravPositivt(vara.mangd, `Mängden för ${namn}`);
    const enhet = slaUppEnhet(vara.enhet);
    const omraknad = tillHuvudenhet({ value: vara.mangd, unit: vara.enhet }, alternativ?.perPackage);
    if (!('value' in omraknad)) {
      throw new RaknefelError(
        'ogiltigt-uttryck',
        'En förpackning har ingen fast storlek, så jämförpriset behöver antal styck.',
      );
    }
    if (omraknad.value <= 0) {
      throw new RaknefelError('division-med-noll', `Mängden för ${namn} blir noll.`);
    }
    return {
      namn,
      pris: vara.pris,
      mangd: vara.mangd,
      enhet: enhet.namn,
      dimension: enhet.dimension,
      iHuvudenhet: omraknad.value,
      huvudenhet: omraknad.unit,
      perEnhet: vara.pris / omraknad.value,
    };
  });

  const forsta = rakna[0]!;
  for (const r of rakna) {
    if (r.dimension !== forsta.dimension) {
      throw new RaknefelError(
        'olika-dimensioner',
        `${r.enhet} och ${forsta.enhet} mäter inte samma sak, så priserna går inte att jämföra.`,
      );
    }
  }

  const sorterade = [...rakna].sort((a, b) => a.perEnhet - b.perEnhet);
  const billigast = sorterade[0]!;
  const dyrast = sorterade[sorterade.length - 1]!;
  const enhetsnamn = HUVUDENHET[forsta.dimension];
  const prisenhet = `${valuta}/${enhetsnamn}`;

  const skillnad = dyrast.perEnhet - billigast.perEnhet;
  const procent = dyrast.perEnhet === 0 ? 0 : (skillnad / dyrast.perEnhet) * 100;

  const rader: Rad[] = rakna.map((r) => ({
    etikett: `${r.namn}: ${formatMangd(r.mangd, r.enhet)} för ${pengar(r.pris, valuta)} ${valuta}`,
    formatted: pengar(r.perEnhet, valuta),
    unit: prisenhet,
    value: r.perEnhet,
  }));

  const steps: Steg[] = rakna.map((r, i) => ({
    nr: i + 1,
    etikett: `Jämförpris ${r.namn}`,
    uttryck: `${pengar(r.pris, valuta)} ${valuta} ÷ ${formatMangd(r.iHuvudenhet, r.huvudenhet)}`,
    resultat: `${pengar(r.perEnhet, valuta)} ${prisenhet}`,
  }));
  steps.push({
    nr: steps.length + 1,
    etikett: 'Skillnad',
    uttryck: `${pengar(dyrast.perEnhet, valuta)} − ${pengar(billigast.perEnhet, valuta)} ${prisenhet}`,
    resultat: `${pengar(skillnad, valuta)} ${prisenhet} (${formatTal(procent, 1)} %)`,
  });

  const fakta: Faktum[] = [
    {
      nyckel: 'perEnhet',
      betydelse: `Billigast per ${enhetsnamn}`,
      value: billigast.perEnhet,
      formatted: pengar(billigast.perEnhet, valuta),
      unit: prisenhet,
    },
    {
      nyckel: 'perEnhet',
      betydelse: `Dyrast per ${enhetsnamn}`,
      value: dyrast.perEnhet,
      formatted: pengar(dyrast.perEnhet, valuta),
      unit: prisenhet,
    },
    {
      nyckel: 'skillnad',
      betydelse: 'Skillnad per enhet',
      value: skillnad,
      formatted: pengar(skillnad, valuta),
      unit: prisenhet,
    },
    {
      nyckel: 'andel',
      betydelse: 'Skillnad i procent',
      value: procent,
      formatted: formatTal(procent, 1),
      unit: '%',
    },
    {
      nyckel: 'resultat',
      betydelse: `Billigast per ${enhetsnamn}`,
      value: billigast.perEnhet,
      formatted: pengar(billigast.perEnhet, valuta),
      unit: prisenhet,
    },
  ];

  return {
    value: billigast.perEnhet,
    unit: prisenhet,
    formatted: pengar(billigast.perEnhet, valuta),
    betydelse: `Billigast är ${billigast.namn}`,
    steps,
    villkor: [
      `${billigast.namn} är ${pengar(skillnad, valuta)} ${valuta} billigare per ${enhetsnamn}, alltså ${formatTal(procent, 1)} %`,
    ],
    rader,
    fakta,
  };
}

// ---------------------------------------------------------------------------
// 31. Dela kostnader
// ---------------------------------------------------------------------------

export interface Utlagg {
  readonly namn?: string;
  /** Vad personen redan har betalat. */
  readonly betalat: number;
}

export interface SplitCostAlternativ {
  readonly valuta?: string;
  /** Vad hela notan blev, när utläggen inte är kända. */
  readonly total?: number;
}

/**
 * Delar en kostnad lika och säger vem som ska betala vem.
 *
 * Är utläggen kända räknas vad var och en ska bära och de överföringar som
 * gör det jämnt. Antalet överföringar hålls nere: den som har mest kvar att
 * få in får de största beloppen först, så tre personer blir två överföringar
 * i stället för tre.
 */
export function splitCost(
  utlagg: readonly Utlagg[],
  antalPersoner?: number,
  alternativ?: SplitCostAlternativ,
): Resultat {
  const valuta = alternativ?.valuta ?? 'kr';
  const harUtlagg = utlagg.length > 0;
  const antal = harUtlagg ? utlagg.length : Math.trunc(antalPersoner ?? 0);

  if (antal < 1) {
    throw new RaknefelError('ogiltigt-tal', 'Det behövs minst en person att dela på.');
  }

  const grund: readonly Utlagg[] = harUtlagg
    ? utlagg
    : Array.from({ length: antal }, () => ({ betalat: 0 }) as Utlagg);
  const personer = grund.map(
    (p, i) => {
      kravTal(p.betalat, 'Utlägget');
      if (p.betalat < 0) {
        throw new RaknefelError('ogiltigt-tal', 'Ett utlägg kan inte vara negativt.');
      }
      return { namn: p.namn ?? BOKSTAVER[i] ?? `Person ${i + 1}`, betalat: p.betalat };
    },
  );

  const summaUtlagg = personer.reduce((s, p) => s + p.betalat, 0);
  const total = harUtlagg ? summaUtlagg : kravPositivt(alternativ?.total ?? 0, 'Totalsumman');
  const perPerson = total / antal;

  const steps: Steg[] = [
    {
      nr: 1,
      etikett: 'Per person',
      uttryck: `${pengar(total, valuta)} ${valuta} ÷ ${formatTal(antal)}`,
      resultat: `${pengar(perPerson, valuta)} ${valuta}`,
    },
  ];

  /** Vad var och en har för mycket (plus) eller för lite (minus). */
  const saldon = personer.map((p) => ({ namn: p.namn, saldo: p.betalat - perPerson }));

  const rader: Rad[] = personer.map((p) => ({
    etikett: harUtlagg ? `${p.namn}: betalat ${pengar(p.betalat, valuta)} ${valuta}` : p.namn,
    formatted: pengar(perPerson, valuta),
    unit: valuta,
    value: perPerson,
  }));

  // Överföringarna: den som betalat för lite betalar den som betalat för
  // mycket, största belopp först. Ett öre hit eller dit räknas som jämnt.
  const steg = valutasteg(valuta);
  const skuld = saldon.filter((s) => s.saldo < -steg / 2).sort((a, b) => a.saldo - b.saldo);
  const fordran = saldon.filter((s) => s.saldo > steg / 2).sort((a, b) => b.saldo - a.saldo);
  let i = 0;
  let j = 0;
  let nr = steps.length;
  const overforingar: Rad[] = [];
  while (i < skuld.length && j < fordran.length) {
    const ger = skuld[i]!;
    const far = fordran[j]!;
    const belopp = Math.min(-ger.saldo, far.saldo);
    overforingar.push({
      etikett: `${ger.namn} betalar ${far.namn}`,
      formatted: pengar(belopp, valuta),
      unit: valuta,
      value: belopp,
    });
    steps.push({
      nr: (nr += 1),
      etikett: 'Överföring',
      uttryck: `${ger.namn} → ${far.namn}`,
      resultat: `${pengar(belopp, valuta)} ${valuta}`,
    });
    ger.saldo += belopp;
    far.saldo -= belopp;
    if (-ger.saldo <= steg / 2) i += 1;
    if (far.saldo <= steg / 2) j += 1;
  }

  const fakta: Faktum[] = [
    {
      nyckel: 'belopp',
      betydelse: 'Hela kostnaden',
      value: total,
      formatted: pengar(total, valuta),
      unit: valuta,
    },
    {
      nyckel: 'personer',
      betydelse: 'Antal personer',
      value: antal,
      formatted: formatTal(antal),
      unit: 'st',
    },
    {
      nyckel: 'perPerson',
      betydelse: 'Per person',
      value: perPerson,
      formatted: pengar(perPerson, valuta),
      unit: valuta,
    },
    {
      nyckel: 'resultat',
      betydelse: 'Per person',
      value: perPerson,
      formatted: pengar(perPerson, valuta),
      unit: valuta,
    },
  ];

  const villkor = harUtlagg
    ? [
        `Delat lika på ${formatTal(antal)}`,
        overforingar.length === 1
          ? 'En överföring gör det jämnt'
          : `${formatTal(overforingar.length)} överföringar gör det jämnt`,
      ]
    : [`Delat lika på ${formatTal(antal)}`];

  return {
    value: perPerson,
    unit: valuta,
    formatted: pengar(perPerson, valuta),
    betydelse: harUtlagg ? 'Så går det jämnt ut' : 'Var och en betalar',
    steps,
    villkor,
    rader: [...rader, ...overforingar],
    fakta,
  };
}

// ---------------------------------------------------------------------------
// 32. Förpackningar och svinn
// ---------------------------------------------------------------------------

export interface PackagesAlternativ {
  /** Svinn i procent, t.ex. 10 för 10 %. */
  readonly svinn?: number;
  /** Vad en förpackning heter i svaret: paket, rulle, låda … */
  readonly forpackningsnamn?: string;
}

/**
 * Hur många förpackningar som behövs, och vad som blir över.
 *
 * Förpackningar går inte att köpa i halvor, så antalet avrundas UPPÅT (F01):
 * `value` bär heltalet och `exakt` det exakta antalet, med skälet. Svinnet
 * läggs på behovet innan delningen — det är därför man räknar med det.
 */
export function packages(
  behov: number,
  forpackning: number,
  enhet: string,
  alternativ?: PackagesAlternativ,
): Resultat {
  kravPositivt(behov, 'Behovet');
  kravPositivt(forpackning, 'Förpackningsstorleken');
  const svinnProcent = alternativ?.svinn ?? 0;
  kravTal(svinnProcent, 'Svinnet');
  if (svinnProcent < 0) {
    throw new RaknefelError('ogiltigt-tal', 'Svinnet kan inte vara negativt.');
  }
  if (svinnProcent >= 100) {
    throw new RaknefelError(
      'ogiltigt-tal',
      'Ett svinn på 100 % eller mer betyder att ingenting blir kvar att använda.',
    );
  }
  const namn = alternativ?.forpackningsnamn ?? 'förpackningar';
  const e = slaUppEnhet(enhet).namn;

  const svinnMangd = behov * (svinnProcent / 100);
  const medSvinn = behov + svinnMangd;
  const exakt = medSvinn / forpackning;
  const antal = Math.ceil(exakt - 1e-9);
  const koptMangd = antal * forpackning;
  const overskott = koptMangd - medSvinn;

  const steps: Steg[] = [];
  if (svinnProcent > 0) {
    steps.push({
      nr: 1,
      etikett: 'Behov med svinn',
      uttryck: `${formatMangd(behov, e)} + ${formatTal(svinnProcent)} %`,
      resultat: formatMangd(medSvinn, e),
    });
  }
  steps.push({
    nr: steps.length + 1,
    etikett: `Antal ${namn}`,
    uttryck: `${formatMangd(medSvinn, e)} ÷ ${formatMangd(forpackning, e)}`,
    resultat: formatTal(exakt, 2),
  });
  steps.push({
    nr: steps.length + 1,
    etikett: 'Avrundat uppåt',
    uttryck: `${formatTal(exakt, 2)} → ${formatTal(antal)}`,
    resultat: `${formatTal(antal)} ${namn}`,
  });
  steps.push({
    nr: steps.length + 1,
    etikett: 'Blir över',
    uttryck: `${formatMangd(koptMangd, e)} − ${formatMangd(medSvinn, e)}`,
    resultat: formatMangd(overskott, e),
  });

  const rader: Rad[] = [
    { etikett: 'Behov', formatted: formatTal(behov, 1), unit: e, value: behov },
    ...(svinnProcent > 0
      ? [
          {
            etikett: `Svinn ${formatTal(svinnProcent)} %`,
            formatted: formatTal(svinnMangd, 1),
            unit: e,
            value: svinnMangd,
          },
        ]
      : []),
    { etikett: 'Överskott', formatted: formatTal(overskott, 1), unit: e, value: overskott },
  ];

  const fakta: Faktum[] = [
    { nyckel: 'mangd', betydelse: 'Behov', value: behov, formatted: formatTal(behov, 1), unit: e },
    {
      nyckel: 'svinn',
      betydelse: 'Svinn',
      value: svinnMangd,
      formatted: formatTal(svinnMangd, 1),
      unit: e,
    },
    {
      nyckel: 'forpackningar',
      betydelse: `Antal ${namn}`,
      value: antal,
      formatted: formatTal(antal),
      unit: namn,
    },
    {
      nyckel: 'overskott',
      betydelse: 'Blir över',
      value: overskott,
      formatted: formatTal(overskott, 1),
      unit: e,
    },
    {
      nyckel: 'resultat',
      betydelse: `Antal ${namn}`,
      value: antal,
      formatted: formatTal(antal),
      unit: namn,
    },
  ];

  return {
    value: antal,
    unit: namn,
    formatted: formatTal(antal),
    betydelse: `Antal ${namn} att köpa`,
    steps,
    villkor: [
      svinnProcent > 0
        ? `${formatMangd(medSvinn, e)} behövs med ${formatTal(svinnProcent)} % svinn`
        : `${formatMangd(medSvinn, e)} behövs`,
      `${formatMangd(overskott, e)} blir över`,
    ],
    rader,
    fakta,
    exakt: {
      value: exakt,
      formatted: formatTal(exakt, 2),
      unit: namn,
      skal: `Förpackningar går bara att köpa hela, så ${formatTal(exakt, 2)} avrundas uppåt.`,
    },
  };
}

// ---------------------------------------------------------------------------
// 33. Arbetstid
// ---------------------------------------------------------------------------

export interface Arbetsdag {
  /** Klockslag "07:30". */
  readonly start: string;
  readonly slut: string;
  /** Rast i minuter. */
  readonly rast?: number;
  /** Dagens namn i svaret, t.ex. "Måndag". Annars Dag 1, Dag 2 … */
  readonly namn?: string;
}

export interface WorkTimeAlternativ {
  readonly timlon?: number;
  readonly valuta?: string;
  /**
   * Vad frågan frågade efter (direktiv 24).
   *
   * "Hur länge jobbade jag" vill ha tiden, "vad tjänar jag" vill ha lönen.
   * Det andra visas som en rad under. Utan timlön finns bara tiden, och då
   * spelar valet ingen roll.
   */
  readonly huvudsvar?: 'tid' | 'lon';
}

/** Minuter sedan midnatt ur "07:30". Kastar på allt annat än HH:MM. */
function klockslag(text: string): number {
  const traff = /^(\d{1,2})[:.](\d{2})$/u.exec(text.trim());
  if (traff === null) {
    throw new RaknefelError('ogiltigt-uttryck', `"${text}" är inte ett klockslag som HH:MM.`);
  }
  const timmar = Number(traff[1]);
  const minuter = Number(traff[2]);
  if (timmar > 23 || minuter > 59) {
    throw new RaknefelError('ogiltigt-uttryck', `"${text}" är inte ett klockslag som finns.`);
  }
  return timmar * 60 + minuter;
}

/** "8 h 15 min", eller "45 min" när det är under en timme. */
export function formatArbetstid(minuter: number): string {
  const hela = Math.round(minuter);
  const t = Math.trunc(hela / 60);
  const m = hela % 60;
  if (t === 0) return `${formatTal(m)} min`;
  if (m === 0) return `${formatTal(t)} h`;
  return `${formatTal(t)} h ${formatTal(m)} min`;
}

/**
 * Arbetad tid för en eller flera dagar, och lönen när timlönen är känd.
 *
 * Slutar passet på ett klockslag före starten har det gått över midnatt, och
 * dygnet läggs på. Rasten dras av. Blir tiden noll eller negativ efter rasten
 * säger motorn det i stället för att svara med ett minustal.
 */
export function workTime(dagar: readonly Arbetsdag[], alternativ?: WorkTimeAlternativ): Resultat {
  if (dagar.length === 0) {
    throw new RaknefelError('ogiltigt-uttryck', 'Det behövs minst en dag med start och slut.');
  }
  const valuta = alternativ?.valuta ?? 'kr';

  const rakna = dagar.map((dag, i) => {
    const namn = dag.namn ?? (dagar.length === 1 ? 'Arbetad tid' : `Dag ${i + 1}`);
    const start = klockslag(dag.start);
    const slutRatt = klockslag(dag.slut);
    // Över midnatt: slutar 00:30 efter start 22:00 är 2,5 timmar, inte minus.
    const slut = slutRatt <= start ? slutRatt + 24 * 60 : slutRatt;
    const rast = Math.max(0, kravTal(dag.rast ?? 0, 'Rasten'));
    const minuter = slut - start - rast;
    if (minuter <= 0) {
      throw new RaknefelError(
        'negativ-kvarvarande',
        `Rasten på ${formatTal(rast)} minuter är lika lång som eller längre än passet ${dag.start}–${dag.slut}.`,
      );
    }
    return { namn, start: dag.start, slut: dag.slut, rast, minuter, overMidnatt: slutRatt <= start };
  });

  const totaltMinuter = rakna.reduce((s, d) => s + d.minuter, 0);
  const timmar = totaltMinuter / 60;

  const steps: Steg[] = rakna.map((d, i) => ({
    nr: i + 1,
    etikett: d.namn,
    uttryck:
      d.rast > 0
        ? `${d.start}–${d.slut} − ${formatTal(d.rast)} min rast`
        : `${d.start}–${d.slut}`,
    resultat: formatArbetstid(d.minuter),
  }));

  const rader: Rad[] =
    rakna.length > 1
      ? rakna.map((d) => ({
          etikett: `${d.namn}: ${d.start}–${d.slut}`,
          formatted: formatArbetstid(d.minuter),
          unit: '',
          value: d.minuter / 60,
        }))
      : [];

  const fakta: Faktum[] = [
    {
      nyckel: 'arbetstid',
      betydelse: 'Arbetad tid',
      value: timmar,
      formatted: formatTal(timmar, 2),
      unit: 'h',
    },
    {
      nyckel: 'resultat',
      betydelse: 'Arbetad tid',
      value: timmar,
      formatted: formatTal(timmar, 2),
      unit: 'h',
    },
  ];

  const villkor: string[] = [];
  const rastTotal = rakna.reduce((s, d) => s + d.rast, 0);
  if (rastTotal > 0) villkor.push(`${formatTal(rastTotal)} minuter rast är avdragen`);
  if (rakna.some((d) => d.overMidnatt)) villkor.push('Passet går över midnatt');

  // Lönen: timlönen gånger tiden.
  const timlon = alternativ?.timlon;
  if (timlon !== undefined && timlon > 0) {
    kravTal(timlon, 'Timlönen');
    const lonExakt = timmar * timlon;
    steps.push({
      nr: steps.length + 1,
      etikett: 'Lön',
      uttryck: `${formatTal(timmar, 2)} h × ${pengar(timlon, valuta)} ${valuta}`,
      resultat: `${pengar(lonExakt, valuta)} ${valuta}`,
    });
    fakta.push(
      {
        nyckel: 'timmar',
        betydelse: 'Timlön',
        value: timlon,
        formatted: pengar(timlon, valuta),
        unit: `${valuta}/h`,
      },
      {
        nyckel: 'lon',
        betydelse: 'Lön',
        value: lonExakt,
        formatted: pengar(lonExakt, valuta),
        unit: valuta,
      },
    );
    // Frågade någon "hur länge?" är tiden svaret, också när timlönen står i
    // frågan. Lönen ligger då i fakta och i stegen, och vyn visar den som en
    // rad under tiden (direktiv 24).
    if (alternativ?.huvudsvar === 'tid') {
      return {
        value: timmar,
        unit: '',
        formatted: formatArbetstid(totaltMinuter),
        betydelse: rakna.length > 1 ? 'Arbetad tid, alla dagar' : 'Arbetad tid',
        steps,
        villkor: [`Lön ${pengar(lonExakt, valuta)} ${valuta}`, ...villkor],
        ...(rader.length > 0 ? { rader } : {}),
        fakta,
      };
    }

    return {
      value: lonExakt,
      unit: valuta,
      formatted: pengar(lonExakt, valuta),
      betydelse: 'Lön för arbetad tid',
      steps,
      villkor: [`Arbetad tid ${formatArbetstid(totaltMinuter)}`, ...villkor],
      ...(rader.length > 0 ? { rader } : {}),
      fakta,
    };
  }

  return {
    value: timmar,
    // Tom enhet: `formatted` bar den redan ("8 h 15 min"), och resultatvyn
    // satter enheten efter talet - "8 h 15 min h" sag fel i produktion.
    unit: '',
    formatted: formatArbetstid(totaltMinuter),
    betydelse: rakna.length > 1 ? 'Arbetad tid, alla dagar' : 'Arbetad tid',
    steps,
    ...(villkor.length > 0 ? { villkor } : {}),
    ...(rader.length > 0 ? { rader } : {}),
    fakta,
  };
}
