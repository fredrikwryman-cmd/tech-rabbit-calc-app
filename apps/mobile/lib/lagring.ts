/**
 * Lokal lagring: historiken och inställningarna.
 *
 * AsyncStorage är det enda stället de ligger på. Inget lämnar telefonen.
 * Läsning är alltid tålig: trasig eller gammal data kastas, appen startar ändå.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { arFaktumnyckel } from '@techrabbit/engine';
import type { Faktum, Rad, Resultat } from '@techrabbit/engine';

const NYCKEL_HISTORIK = 'techrabbit.kalkylator.historik.v1';
const NYCKEL_INSTALLNINGAR = 'techrabbit.kalkylator.installningar.v1';
/** Utkastet: frågan användaren skrivit men inte räknat än. */
const NYCKEL_UTKAST = 'techrabbit.kalkylator.utkast.v1';

/** Ett steg som det sparas. Samma form som motorns Steg. */
export interface SparatSteg {
  readonly nr: number;
  readonly etikett: string;
  readonly uttryck: string;
  readonly resultat: string;
}

/**
 * Ett faktum som det sparas.
 *
 * Direktiv 23: utan fakta kan en sparad uträkning inte veta vilket räknesätt
 * den kom ur, och vyerna 30–33 öppnades som vy 05 när man gick in via
 * Historik. Nyckeln är räknesättets signatur (lib/resultatvy.ts), så den
 * måste följa med i lagringen.
 */
export interface SparatFaktum {
  readonly nyckel: string;
  readonly betydelse: string;
  readonly value: number;
  readonly formatted: string;
  readonly unit: string;
}

/** En rad under huvudtalet som den sparas. */
export interface SparadRad {
  readonly etikett: string;
  readonly formatted: string;
  readonly unit: string;
  readonly value: number;
}

/** Det praktiska priset som det sparas (F01). */
export interface SparatPraktiskt {
  readonly formatted: string;
  readonly unit: string;
  readonly skal: string;
}

/**
 * En rad i historiken.
 *
 * `villkor` och `praktiskt` sparas med, så att ett gammalt resultat visas
 * likadant som när det räknades. Utan dem skulle en gammal post se ut som ett
 * svar utan förbehåll — och villkoren är en del av svaret, inte en prydnad.
 * Poster sparade före direktiv 11 saknar fälten; då visas posten som förut.
 */
export interface Historikpost {
  readonly id: string;
  readonly fraga: string;
  /** Färdigformaterat resultat med enhet, t.ex. "17,14 kr/kg". */
  readonly resultat: string;
  readonly etikett: string;
  readonly forklaring: string;
  readonly steg: readonly SparatSteg[];
  /** Avgörande förutsättningar, t.ex. ["Om alla 260 säljs"]. */
  readonly villkor?: readonly string[];
  /** Värdet som uppfyller målet när avrundning krävdes. */
  readonly praktiskt?: SparatPraktiskt;
  /**
   * Motorns typade fakta. Avgör vilken resultatvy posten öppnas i.
   * Poster sparade före direktiv 23 saknar fältet; de öppnas i vy 05.
   */
  readonly fakta?: readonly SparatFaktum[];
  /** Raderna under huvudtalet, t.ex. varorna i en prisjämförelse. */
  readonly rader?: readonly SparadRad[];
  /** Det exakta talet, när svaret är avrundat (F01). */
  readonly exakt?: SparatPraktiskt;
  /** ISO 8601, i enhetlig form så sorteringen blir rätt. */
  readonly datum: string;
}

export type Utseende = 'system' | 'light' | 'dark';

export interface Installningar {
  readonly valuta: string;
  readonly sprak: string;
  readonly aiModell: string;
  readonly utseende: Utseende;
  readonly knappvibration: boolean;
}

export const STANDARDINSTALLNINGAR: Installningar = {
  valuta: 'SEK',
  sprak: 'Svenska',
  // Modellnamnen är inte bestämda. "Standard" är enda valet tills de är det.
  aiModell: 'Standard',
  utseende: 'system',
  knappvibration: true,
};

function arUtseende(v: unknown): v is Utseende {
  return v === 'system' || v === 'light' || v === 'dark';
}

/** Ett sparat faktum, eller null när posten är trasig. */
function lasFaktum(v: unknown): SparatFaktum[] {
  if (typeof v !== 'object' || v === null) return [];
  const f = v as Record<string, unknown>;
  // Samma kontroll som i api-tolkare.ts: motorns lista, ingen kopia.
  if (typeof f['nyckel'] !== 'string' || !arFaktumnyckel(f['nyckel'])) return [];
  if (typeof f['formatted'] !== 'string') return [];
  return [
    {
      nyckel: f['nyckel'],
      betydelse: typeof f['betydelse'] === 'string' ? f['betydelse'] : f['nyckel'],
      value: typeof f['value'] === 'number' && Number.isFinite(f['value']) ? f['value'] : 0,
      formatted: f['formatted'],
      unit: typeof f['unit'] === 'string' ? f['unit'] : '',
    },
  ];
}

/** En sparad rad, eller inget när posten är trasig. */
function lasRad(v: unknown): SparadRad[] {
  if (typeof v !== 'object' || v === null) return [];
  const r = v as Record<string, unknown>;
  if (typeof r['etikett'] !== 'string' || typeof r['formatted'] !== 'string') return [];
  return [
    {
      etikett: r['etikett'],
      formatted: r['formatted'],
      unit: typeof r['unit'] === 'string' ? r['unit'] : '',
      value: typeof r['value'] === 'number' && Number.isFinite(r['value']) ? r['value'] : 0,
    },
  ];
}

/**
 * Läser en sparad post. Exporterad för testet som följer hela vägen:
 * svar från nätet -> historikpost -> tillbaka till ett resultat (direktiv 26).
 */
export function lasHistorikpost(v: unknown): Historikpost | null {
  if (typeof v !== 'object' || v === null) return null;
  const p = v as Record<string, unknown>;
  if (typeof p['id'] !== 'string' || typeof p['fraga'] !== 'string') return null;
  if (typeof p['resultat'] !== 'string' || typeof p['datum'] !== 'string') return null;
  const steg = Array.isArray(p['steg'])
    ? p['steg'].flatMap((s): SparatSteg[] => {
        if (typeof s !== 'object' || s === null) return [];
        const r = s as Record<string, unknown>;
        if (typeof r['uttryck'] !== 'string' || typeof r['resultat'] !== 'string') return [];
        return [
          {
            nr: typeof r['nr'] === 'number' ? r['nr'] : 0,
            etikett: typeof r['etikett'] === 'string' ? r['etikett'] : '',
            uttryck: r['uttryck'],
            resultat: r['resultat'],
          },
        ];
      })
    : [];
  const villkor = Array.isArray(p['villkor'])
    ? p['villkor'].filter((v): v is string => typeof v === 'string')
    : [];
  return {
    id: p['id'],
    fraga: p['fraga'],
    resultat: p['resultat'],
    etikett: typeof p['etikett'] === 'string' ? p['etikett'] : '',
    forklaring: typeof p['forklaring'] === 'string' ? p['forklaring'] : '',
    steg,
    ...(villkor.length > 0 ? { villkor } : {}),
    ...(lasPraktiskt(p['praktiskt']) ?? {}),
    ...(() => {
      const exakt = lasPraktiskt(p['exakt']);
      return exakt === null ? {} : { exakt: exakt.praktiskt };
    })(),
    ...(() => {
      const fakta = Array.isArray(p['fakta']) ? p['fakta'].flatMap(lasFaktum) : [];
      return fakta.length > 0 ? { fakta } : {};
    })(),
    ...(() => {
      const rader = Array.isArray(p['rader']) ? p['rader'].flatMap(lasRad) : [];
      return rader.length > 0 ? { rader } : {};
    })(),
    datum: p['datum'],
  };
}

/** Allt eller inget: en halv rad är ingen rad. */
function lasPraktiskt(v: unknown): { praktiskt: SparatPraktiskt } | null {
  if (typeof v !== 'object' || v === null) return null;
  const p = v as Record<string, unknown>;
  if (typeof p['formatted'] !== 'string') return null;
  if (typeof p['unit'] !== 'string' || typeof p['skal'] !== 'string') return null;
  return { praktiskt: { formatted: p['formatted'], unit: p['unit'], skal: p['skal'] } };
}

/** Historiken, nyast först. Trasiga poster hoppas över. */
export async function lasHistorik(): Promise<readonly Historikpost[]> {
  try {
    const ratt = await AsyncStorage.getItem(NYCKEL_HISTORIK);
    if (!ratt) return [];
    const data: unknown = JSON.parse(ratt);
    if (!Array.isArray(data)) return [];
    return data.flatMap((v) => {
      const post = lasHistorikpost(v);
      return post ? [post] : [];
    });
  } catch {
    return [];
  }
}

export async function skrivHistorik(poster: readonly Historikpost[]): Promise<void> {
  try {
    await AsyncStorage.setItem(NYCKEL_HISTORIK, JSON.stringify(poster));
  } catch {
    // Att historiken inte kunde sparas får aldrig fälla en uträkning.
  }
}

export async function lasInstallningar(): Promise<Installningar> {
  try {
    const ratt = await AsyncStorage.getItem(NYCKEL_INSTALLNINGAR);
    if (!ratt) return STANDARDINSTALLNINGAR;
    const data: unknown = JSON.parse(ratt);
    if (typeof data !== 'object' || data === null) return STANDARDINSTALLNINGAR;
    const d = data as Record<string, unknown>;
    return {
      valuta: typeof d['valuta'] === 'string' ? d['valuta'] : STANDARDINSTALLNINGAR.valuta,
      sprak: typeof d['sprak'] === 'string' ? d['sprak'] : STANDARDINSTALLNINGAR.sprak,
      aiModell:
        typeof d['aiModell'] === 'string' ? d['aiModell'] : STANDARDINSTALLNINGAR.aiModell,
      utseende: arUtseende(d['utseende']) ? d['utseende'] : STANDARDINSTALLNINGAR.utseende,
      knappvibration:
        typeof d['knappvibration'] === 'boolean'
          ? d['knappvibration']
          : STANDARDINSTALLNINGAR.knappvibration,
    };
  } catch {
    return STANDARDINSTALLNINGAR;
  }
}

export async function skrivInstallningar(v: Installningar): Promise<void> {
  try {
    await AsyncStorage.setItem(NYCKEL_INSTALLNINGAR, JSON.stringify(v));
  } catch {
    // Tyst. Valet gäller i alla fall den här starten.
  }
}

/** "Idag 14:32", "Igår", "12 nov" — som i design/vyer/07_historik. */
const MANADER = [
  'jan', 'feb', 'mars', 'april', 'maj', 'juni',
  'juli', 'aug', 'sep', 'okt', 'nov', 'dec',
];

export function visaDatum(iso: string, nu: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dag = (x: Date): number => Math.floor((x.getTime() - x.getTimezoneOffset() * 60_000) / 86_400_000);
  const skillnad = dag(nu) - dag(d);
  const tid = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (skillnad === 0) return `Idag ${tid}`;
  if (skillnad === 1) return 'Igår';
  return `${d.getDate()} ${MANADER[d.getMonth()] ?? ''}`;
}

// --------------------------------------------------------------- utkastet

/**
 * Frågan användaren börjat skriva.
 *
 * Sparas vid varje ändring och läses vid start, så att en halvskriven fråga
 * överlever att man går till Historik och tillbaka, och att appen stängs.
 * Den rensas när frågan räknats eller när användaren börjar om.
 */
export async function lasUtkast(): Promise<string> {
  try {
    const v = await AsyncStorage.getItem(NYCKEL_UTKAST);
    return typeof v === 'string' ? v : '';
  } catch {
    return '';
  }
}

export async function skrivUtkast(fraga: string): Promise<void> {
  try {
    if (fraga.trim() === '') await AsyncStorage.removeItem(NYCKEL_UTKAST);
    else await AsyncStorage.setItem(NYCKEL_UTKAST, fraga);
  } catch {
    // Ett utkast som inte kunde sparas får aldrig fälla en uträkning.
  }
}

/**
 * En sparad post som ett Resultat, så att Historik kan visa samma sheet som
 * Räkna gör.
 *
 * `value` är 0 och fakta tom: historiken sparar det som VISAS, inte det
 * exakta talet eller indata. Det betyder att "Jag räknade med" inte visas för
 * en gammal post — hellre det än att visa påhittade värden att ändra i.
 */
export function postSomResultat(post: Historikpost): Resultat {
  const [varde = post.resultat, ...resten] = post.resultat.split(' ');
  return {
    value: 0,
    unit: resten.join(' '),
    formatted: varde,
    betydelse: post.etikett,
    steps: post.steg.map((s) => ({
      nr: s.nr,
      etikett: s.etikett,
      uttryck: s.uttryck,
      resultat: s.resultat,
    })),
    ...(post.villkor && post.villkor.length > 0 ? { villkor: post.villkor } : {}),
    // Fakta och rader avgor vilken resultatvy posten oppnas i (30-33).
    // Nyckeln kommer fran motorn och ar redan kontrollerad vid lasningen;
    // typen smalnas av har, dar den ska bli ett Resultat igen.
    ...(post.fakta && post.fakta.length > 0
      ? {
          fakta: post.fakta.flatMap((f): Faktum[] =>
            arFaktumnyckel(f.nyckel)
              ? [{
                  nyckel: f.nyckel,
                  betydelse: f.betydelse,
                  value: f.value,
                  formatted: f.formatted,
                  unit: f.unit,
                }]
              : [],
          ),
        }
      : {}),
    ...(post.rader && post.rader.length > 0
      ? {
          rader: post.rader.map(
            (r): Rad => ({
              etikett: r.etikett,
              formatted: r.formatted,
              unit: r.unit,
              value: r.value,
            }),
          ),
        }
      : {}),
    ...(post.exakt
      ? {
          exakt: {
            value: 0,
            formatted: post.exakt.formatted,
            unit: post.exakt.unit,
            skal: post.exakt.skal,
          },
        }
      : {}),
    ...(post.praktiskt
      ? {
          praktiskt: {
            value: 0,
            formatted: post.praktiskt.formatted,
            unit: post.praktiskt.unit,
            skal: post.praktiskt.skal,
            mal: 'ingen' as const,
          },
        }
      : {}),
  };
}
