/**
 * Chattens tråd: grupper, svansar, datumrubriker och tiden i bubblan.
 *
 * Direktiv 40, rev-ux 5.2 och 8.6. Ren funktion utan React och utan
 * lagring, så reglerna går att testa i Node: det är gruppgränsen och
 * svanslogiken som ska skyddas, inte hur en bubbla råkar ritas.
 *
 * Tråden byggs ÄLDST FÖRST, som den läses. Den inverterade listan vänder
 * den sedan en gång (`inverterat`), så ingen vy behöver tänka baklänges.
 */

/** Samma avsändare inom tre minuter hör till samma grupp (rev-ux 5.2). */
export const GRUPP_MS = 3 * 60_000;

/** Avstånd inom en grupp. rev-ux säger 2–4 pt. */
export const LUCKA_INOM = 3;

/** Avstånd mellan grupper. */
export const LUCKA_MELLAN = 12;

const MANADER = [
  'jan',
  'feb',
  'mar',
  'apr',
  'maj',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
] as const;

/** Det tråden behöver veta om ett meddelande. Resten rör den inte. */
export interface Tradbart {
  readonly roll: string;
  /** Millisekunder. Meddelanden sparade före direktiv 40 saknar tiden. */
  readonly at?: number;
}

export interface Gruppflaggor {
  /** Först i sin grupp: ovanför ligger en annan avsändare eller en lucka. */
  readonly forst: boolean;
  /** Sist i sin grupp. Svansen och kaninen hör till den här bubblan. */
  readonly sist: boolean;
}

export type Tradpost<M> =
  | {
      readonly sort: 'datum';
      readonly nyckel: string;
      /** "Idag", "Igår" eller "8 jul". */
      readonly text: string;
    }
  | {
      readonly sort: 'meddelande';
      readonly nyckel: string;
      readonly m: M;
      readonly forst: boolean;
      readonly sist: boolean;
      /** Luckan OVANFÖR posten, i punkter. */
      readonly lucka: number;
      /** Platsen i tråden, för att kunna fördröja entrén i ordning. */
      readonly nr: number;
    };

/**
 * Sant när två meddelanden ligger nära nog i tid att höra samman.
 *
 * Saknas tiden på något av dem (en tråd sparad före direktiv 40) grupperas
 * de på avsändaren ensam. Att i stället bryta varje grupp hade gett en
 * svans på varje gammal bubbla, alltså precis det som skulle bort.
 */
export function naraITid(a: Tradbart, b: Tradbart): boolean {
  if (a.at === undefined || b.at === undefined) return true;
  return Math.abs(b.at - a.at) < GRUPP_MS;
}

/** Grupperna, enligt rev-ux 8.6: svans bara när `sist`. */
export function medGrupper<M extends Tradbart>(
  meddelanden: readonly M[],
): readonly (M & Gruppflaggor)[] {
  return meddelanden.map((m, i) => {
    const fore = meddelanden[i - 1];
    const efter = meddelanden[i + 1];
    return {
      ...m,
      forst: !(fore !== undefined && fore.roll === m.roll && naraITid(fore, m)),
      sist: !(efter !== undefined && efter.roll === m.roll && naraITid(m, efter)),
    };
  });
}

/** Dygnsnumret i telefonens egen tidszon, så dygnsbyten hamnar rätt. */
function dag(d: Date): number {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000);
}

/** Datumrubriken över dagens första grupp: "Idag", "Igår" eller "8 jul". */
export function datumrubrik(at: number, nu: Date = new Date()): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  const skillnad = dag(nu) - dag(d);
  if (skillnad === 0) return 'Idag';
  if (skillnad === 1) return 'Igår';
  return `${d.getDate()} ${MANADER[d.getMonth()] ?? ''}`;
}

/** Tiden inne i bubblan, nere till höger (rev-ux 5.2). */
export function tidIBubbla(at: number | undefined): string {
  if (at === undefined) return '';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Hela tråden: datumrubriker, grupper, svansar och luckor.
 *
 * Nyckeln bärs av posten själv. Ett meddelande har ingen egen identitet i
 * lagringen, så nyckeln är platsen plus tiden — stabil så länge tråden bara
 * växer i slutet, vilket är det enda som händer med en chatt.
 */
export function byggTrad<M extends Tradbart>(
  meddelanden: readonly M[],
  nu: Date = new Date(),
): readonly Tradpost<M & Gruppflaggor>[] {
  const grupperade = medGrupper(meddelanden);
  const ut: Tradpost<M & Gruppflaggor>[] = [];
  let senasteDag: number | null = null;

  grupperade.forEach((m, i) => {
    if (m.at !== undefined) {
      const d = dag(new Date(m.at));
      if (senasteDag === null || d !== senasteDag) {
        senasteDag = d;
        ut.push({ sort: 'datum', nyckel: `d${d}`, text: datumrubrik(m.at, nu) });
      }
    }
    ut.push({
      sort: 'meddelande',
      nyckel: `m${i}-${m.at ?? 0}`,
      m,
      forst: m.forst,
      sist: m.sist,
      // Första posten i tråden bär ingen lucka: den sitter mot överkanten.
      lucka: i === 0 ? 0 : m.forst ? LUCKA_MELLAN : LUCKA_INOM,
      nr: i,
    });
  });

  return ut;
}

/**
 * Tråden vänd för en inverterad lista.
 *
 * Den inverterade listan ritar index 0 längst NED. Att vända en gång här är
 * billigare än att varje läsare av listan ska tänka baklänges.
 */
export function inverterat<T>(poster: readonly T[]): readonly T[] {
  return [...poster].reverse();
}

// ------------------------------------------------- "Räkna på det" kommer hem

/**
 * Frågan chatten lämnade över till Räkna (rev-ux 5.6, direktiv 40 steg 6).
 *
 * Räkna äger räkningen. Chatten minns bara VAD den lämnade över och NÄR, och
 * letar efter svaret i historiken när fliken visas igen.
 */
export interface Overlamning {
  readonly fraga: string;
  /** Millisekunder. Posten måste vara sparad efter det här. */
  readonly nar: number;
}

/** Det historiken behöver bära för att en post ska gå att känna igen. */
export interface Raknad {
  readonly id: string;
  readonly fraga: string;
  /** ISO 8601. */
  readonly datum: string;
}

/**
 * Lite slack bakåt i tiden.
 *
 * Överlämningen tidsstämplas i chatten och posten i Räkna, med en
 * navigering emellan. Klockan är densamma, men ordningen är inte garanterad
 * på millisekunden, och en post som sparas "strax före" överlämningen är
 * ändå svaret på den.
 */
const SLACK_MS = 3_000;

function nyckelordet(fraga: string): string {
  return fraga.trim().toLowerCase().replace(/\s+/gu, ' ');
}

/**
 * Posten Räkna sparade för den överlämnade frågan, eller null.
 *
 * `redan` är id:n chatten redan lagt in i tråden, så samma uträkning aldrig
 * landar två gånger.
 */
export function hittaRaknat<P extends Raknad>(
  historik: readonly P[],
  overlamning: Overlamning,
  redan: readonly string[] = [],
): P | null {
  const sokt = nyckelordet(overlamning.fraga);
  if (sokt === '') return null;
  const traffar = historik.filter((p) => {
    if (redan.includes(p.id)) return false;
    if (nyckelordet(p.fraga) !== sokt) return false;
    const t = Date.parse(p.datum);
    return !Number.isNaN(t) && t >= overlamning.nar - SLACK_MS;
  });
  if (traffar.length === 0) return null;
  // Nyast först: historiken sparas så, men sorteringen här gör svaret
  // oberoende av det.
  return traffar.reduce((bast, p) => (Date.parse(p.datum) > Date.parse(bast.datum) ? p : bast));
}
