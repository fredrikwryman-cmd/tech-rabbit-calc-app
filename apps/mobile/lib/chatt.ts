/**
 * Fråga-läget: enhets-id, samtalen och strömningen mot /api/chat.
 *
 * Tjänsten är tillståndslös. Appen äger samtalet, skickar hela tråden varje
 * gång och sparar den lokalt. Inget lämnar telefonen utom det som skickas med
 * frågan, och enhets-id:t är ett slumptal appen hittat på — det säger inget om
 * vem det är.
 *
 * ## Varför XMLHttpRequest och inte fetch
 *
 * Svaret är Server-Sent Events och ska visas medan det kommer. `fetch` i
 * Hermes ger ingen läsbar ström: `response.body` är null, och texten kommer
 * först när allt är klart. XHR:s `onprogress` ger `responseText` medan den
 * växer, vilket är precis vad som behövs. Det är inte vackert, men det är det
 * som fungerar i ett riktigt bygge.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { kallorUr, las429, Sselasare, type Kalla, type Taksvar } from './chatt-karna.ts';

export { tidKvar } from './chatt-karna.ts';
export type { Kalla } from './chatt-karna.ts';

const NYCKEL_ENHET = 'techrabbit.kalkylator.enhetsid.v1';
const NYCKEL_SAMTAL = 'techrabbit.kalkylator.samtal.v1';

/** Hur många samtal som sparas. Äldre faller bort. */
const MAX_SAMTAL = 50;

// --------------------------------------------------------------- enhets-id

/**
 * Slumpas en gång och sparas sedan.
 *
 * Servern räknar dygnstaket per enhet på det här. Det är ett slumptal utan
 * koppling till telefonen, kontot eller personen — det enda det säger är
 * "samma app som förra gången".
 */
export async function enhetsId(): Promise<string> {
  try {
    const sparat = await AsyncStorage.getItem(NYCKEL_ENHET);
    if (typeof sparat === 'string' && sparat.trim().length >= 8) return sparat;
  } catch {
    // Går lagringen inte att läsa får ett nytt id duga för den här starten.
  }
  const nytt = slumpId();
  try {
    await AsyncStorage.setItem(NYCKEL_ENHET, nytt);
  } catch {
    // Tyst: ett id som inte kunde sparas fungerar ändå just nu.
  }
  return nytt;
}

function slumpId(): string {
  let ut = '';
  while (ut.length < 24) ut += Math.random().toString(36).slice(2);
  return ut.slice(0, 24);
}

// ----------------------------------------------------------------- samtalen

export type Roll = 'du' | 'jag';

export interface Meddelande {
  readonly roll: Roll;
  readonly text: string;
  /** Frågan som ska flyttas till Räkna, när svaret lämnade över (12c). */
  readonly raknaPa?: string;
  /** Sant när användaren tryckte Stoppa mitt i svaret. */
  readonly stoppat?: boolean;
  /** Källorna svaret slogs upp i, när Rabbit AI sökte på webben. */
  readonly kallor?: readonly Kalla[];
}

export interface Samtal {
  readonly id: string;
  readonly meddelanden: readonly Meddelande[];
  /** ISO 8601. Tiden för det senaste meddelandet. */
  readonly datum: string;
}

/** Första frågan, som är samtalets rubrik i historiken. */
export function samtalsrubrik(s: Samtal): string {
  return s.meddelanden.find((m) => m.roll === 'jag')?.text.trim() ?? 'Samtal';
}

function lasMeddelande(v: unknown): Meddelande[] {
  if (typeof v !== 'object' || v === null) return [];
  const m = v as Record<string, unknown>;
  if (m['roll'] !== 'du' && m['roll'] !== 'jag') return [];
  if (typeof m['text'] !== 'string') return [];
  return [
    {
      roll: m['roll'],
      text: m['text'],
      ...(typeof m['raknaPa'] === 'string' ? { raknaPa: m['raknaPa'] } : {}),
      ...(m['stoppat'] === true ? { stoppat: true } : {}),
      // Källorna sparas med samtalet och läses tillbaka genom samma
      // kontroll som strömmen: en trasig post blir ingen rad.
      ...(() => {
        const sparade = kallorUr(m as Record<string, unknown>);
        return sparade.length > 0 ? { kallor: sparade } : {};
      })(),
    },
  ];
}

function lasSamtal(v: unknown): Samtal[] {
  if (typeof v !== 'object' || v === null) return [];
  const s = v as Record<string, unknown>;
  if (typeof s['id'] !== 'string' || typeof s['datum'] !== 'string') return [];
  const meddelanden = Array.isArray(s['meddelanden'])
    ? s['meddelanden'].flatMap(lasMeddelande)
    : [];
  if (meddelanden.length === 0) return [];
  return [{ id: s['id'], meddelanden, datum: s['datum'] }];
}

/** Samtalen, nyast först. Trasiga poster hoppas över. */
export async function lasSamtalen(): Promise<readonly Samtal[]> {
  try {
    const ratt = await AsyncStorage.getItem(NYCKEL_SAMTAL);
    if (!ratt) return [];
    const data: unknown = JSON.parse(ratt);
    if (!Array.isArray(data)) return [];
    return data.flatMap(lasSamtal);
  } catch {
    return [];
  }
}

export async function skrivSamtalen(samtal: readonly Samtal[]): Promise<void> {
  try {
    await AsyncStorage.setItem(NYCKEL_SAMTAL, JSON.stringify(samtal.slice(0, MAX_SAMTAL)));
  } catch {
    // Att ett samtal inte kunde sparas får aldrig fälla ett pågående svar.
  }
}

// --------------------------------------------------------------- strömningen

function basadress(): string | null {
  const rad = process.env['EXPO_PUBLIC_API_URL'];
  if (typeof rad !== 'string') return null;
  const rensad = rad.trim().replace(/\/+$/, '');
  return rensad === '' ? null : rensad;
}

export const CHAT_URL: string | null = (() => {
  const bas = basadress();
  return bas === null ? null : `${bas}/api/chat`;
})();

/** Vad ett avslutat svar landade i. */
export type Chattslut =
  | {
      readonly sort: 'klart';
      readonly raknaPa?: string;
      /** Källorna, när svaret slogs upp på webben. */
      readonly kallor?: readonly Kalla[];
    }
  | { readonly sort: 'stoppat' }
  /**
   * Serverns tak: dagens frågor slut (12d) eller för många på kort tid
   * (direktiv 30). Båda formerna och tolkningen av dem bor i `Taksvar`, så
   * att appen och kroppen servern skickar inte kan glida isär.
   */
  | Taksvar
  | { readonly sort: 'fel'; readonly typ: 'server' | 'ingen-anslutning' };

export interface Chattlyssnare {
  /** En bit text. Anropas många gånger medan svaret kommer. */
  readonly text: (bit: string) => void;
  /** Modellen slår upp något på webben. Anropas en gång per svar, om alls. */
  readonly soker?: () => void;
  readonly klart: (slut: Chattslut) => void;
}

/** Det som går att avbryta medan svaret strömmar. */
export interface Stromning {
  stoppa(): void;
}

/**
 * Skickar tråden och strömmar svaret.
 *
 * Returnerar direkt. Texten kommer via `lyssnare.text`, och `lyssnare.klart`
 * anropas exakt en gång. Stoppa avbryter anropet och ger `{ sort: 'stoppat' }`
 * — texten som redan kommit står kvar, för den är inte fel bara för att den
 * är ofullständig.
 */
export function stromma(
  id: string,
  meddelanden: readonly { roll: Roll; text: string }[],
  lyssnare: Chattlyssnare,
): Stromning {
  if (CHAT_URL === null) {
    lyssnare.klart({ sort: 'fel', typ: 'ingen-anslutning' });
    return { stoppa: () => undefined };
  }

  const xhr = new XMLHttpRequest();
  const lasaren = new Sselasare();
  let avslutad = false;
  let stoppad = false;
  let raknaPa: string | undefined;
  let kallor: readonly Kalla[] = [];

  const avsluta = (slut: Chattslut): void => {
    if (avslutad) return;
    avslutad = true;
    lyssnare.klart(slut);
  };

  /** Lamnar over de handelser som tillkommit till lyssnaren. */
  const las = (): void => {
    for (const { namn, kropp } of lasaren.las(xhr.responseText)) {
      if (namn === 'text' && typeof kropp['text'] === 'string') lyssnare.text(kropp['text']);
      else if (namn === 'rakna' && typeof kropp['raknaPa'] === 'string')
        raknaPa = kropp['raknaPa'];
      else if (namn === 'sokning') lyssnare.soker?.();
      else if (namn === 'kallor') kallor = kallorUr(kropp);
      else if (namn === 'fel') avsluta({ sort: 'fel', typ: 'server' });
    }
  };

  xhr.open('POST', CHAT_URL);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Accept', 'text/event-stream');

  xhr.onprogress = (): void => {
    if (xhr.status === 200) las();
  };

  xhr.onload = (): void => {
    // 429: antingen dygnstaket per telefon, eller minuttaket per IP
    // (direktiv 30). Kroppen är JSON, inte en ström, och `las429` avgör
    // vilket taket var: det ena släpper vid midnatt, det andra inom en minut.
    if (xhr.status === 429) {
      avsluta(las429(xhr.responseText));
      return;
    }
    if (xhr.status !== 200) {
      avsluta({ sort: 'fel', typ: 'server' });
      return;
    }
    las();
    avsluta({
      sort: 'klart',
      ...(raknaPa === undefined ? {} : { raknaPa }),
      ...(kallor.length > 0 ? { kallor } : {}),
    });
  };

  xhr.onerror = (): void => avsluta({ sort: 'fel', typ: 'ingen-anslutning' });
  xhr.ontimeout = (): void => avsluta({ sort: 'fel', typ: 'ingen-anslutning' });
  xhr.onabort = (): void => avsluta(stoppad ? { sort: 'stoppat' } : { sort: 'stoppat' });

  xhr.send(
    JSON.stringify({
      enhetsId: id,
      samtal: meddelanden.map((m) => ({ roll: m.roll, text: m.text })),
    }),
  );

  return {
    stoppa: () => {
      stoppad = true;
      xhr.abort();
    },
  };
}
