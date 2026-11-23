/**
 * Tolkaren som frågar tolkningstjänsten i apps/api.
 *
 * Adressen kommer ur `EXPO_PUBLIC_API_URL` och bakas in vid bygget. Ingen
 * API-nyckel finns i appen: nyckeln bor i serverns miljö, och appen känner
 * bara adressen.
 *
 * Svaret från nätet läses aldrig på förtroende. `lasSvar` kontrollerar varje
 * fält, precis som lagring.ts gör med sparad data. Håller formen inte blir det
 * 'kunde-inte-tolka' i stället för en halvfärdig vy. Ett fält som saknas eller
 * är fel sort tas bort; det fäller aldrig hela svaret, för ett resultat utan
 * villkorsrad är bättre än inget resultat.
 */

import { arAvrundningsmal, arFaktumnyckel } from '@techrabbit/engine';
import type {
  Avrundningsmal,
  Faktum,
  Faktumnyckel,
  Rad,
  Resultat,
  Steg,
} from '@techrabbit/engine';

import type { Feltyp, Tolkare, Tolkningssvar, Val } from './tolkning';

/** Hur länge appen väntar på svar. Servern har 30 s på sig; vi ger upp före. */
const TIDSGRANS_MS = 25_000;

/**
 * Hur länge varje steg visas i vy 03 innan nästa tar över.
 *
 * Ett riktigt anrop tar olika lång tid, så det här är en avvägning och inte
 * en mätning: hellre byta lite för tidigt än att stå still på ett steg.
 * Stegen är tre, och det sista står kvar tills svaret kommer.
 */
export const STEG2_EFTER_MS = 2500;
export const STEG3_EFTER_MS = 6000;

function basadress(): string | null {
  const rad = process.env['EXPO_PUBLIC_API_URL'];
  if (typeof rad !== 'string') return null;
  const rensad = rad.trim().replace(/\/+$/, '');
  return rensad === '' ? null : rensad;
}

/** Hela adressen till tolkningen, eller null när ingen är konfigurerad. */
export const API_URL: string | null = (() => {
  const bas = basadress();
  return bas === null ? null : `${bas}/api/ask`;
})();

function text(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function tal(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function post(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
}

/** En lista strängar. Allt som inte är en sträng hoppas över. */
function strangar(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function lasSteg(v: unknown): Steg[] {
  const s = post(v);
  if (!s) return [];
  const uttryck = text(s['uttryck']);
  const resultat = text(s['resultat']);
  if (uttryck === null || resultat === null) return [];
  return [
    {
      nr: tal(s['nr']) ?? 0,
      etikett: text(s['etikett']) ?? '',
      uttryck,
      resultat,
    },
  ];
}

/** En rad under huvudtalet, när frågan har flera svar. */
function lasRad(v: unknown): Rad[] {
  const r = post(v);
  if (!r) return [];
  const etikett = text(r['etikett']);
  const formatted = text(r['formatted']);
  const unit = text(r['unit']);
  const value = tal(r['value']);
  if (etikett === null || formatted === null || unit === null || value === null) return [];
  return [{ etikett, formatted, unit, value }];
}

/** Ett typat faktum. Okänd nyckel kastas: den styr vad som går att ändra. */
function lasFaktum(v: unknown): Faktum[] {
  const f = post(v);
  if (!f) return [];
  const nyckel = text(f['nyckel']);
  const betydelse = text(f['betydelse']);
  const formatted = text(f['formatted']);
  const unit = text(f['unit']);
  const value = tal(f['value']);
  // Nyckeln provas mot MOTORNS lista, inte mot en kopia här. Se
  // FAKTUMNYCKLAR i engine/src/typer.ts: en egen kopia drev isär och tog
  // bort personer och perPerson ur varje svar (direktiv 25).
  if (nyckel === null || !arFaktumnyckel(nyckel)) return [];
  if (betydelse === null || formatted === null || unit === null || value === null) return [];
  return [{ nyckel, betydelse, value, formatted, unit }];
}

/**
 * Det exakta talet (F01), när svaret är avrundat uppåt.
 *
 * Direktiv 26: fältet lästes inte alls, så "Exakt 2,88 kr/st" och "11,50
 * paket" kom aldrig fram till skärmen — motorn skickade dem, appen slängde
 * dem. Samma sorts tapp som faktumnycklarna i direktiv 25. Formen är
 * `praktiskt` utan `mal`.
 */
function lasExakt(v: unknown): Resultat['exakt'] | null {
  const p = post(v);
  if (!p) return null;
  const value = tal(p['value']);
  const formatted = text(p['formatted']);
  const unit = text(p['unit']);
  const skal = text(p['skal']);
  if (value === null || formatted === null || unit === null || skal === null) return null;
  return { value, formatted, unit, skal };
}

/** Det praktiska priset (F01). Allt eller inget: en halv rad är ingen rad. */
function lasPraktiskt(v: unknown): Resultat['praktiskt'] | null {
  const p = post(v);
  if (!p) return null;
  const value = tal(p['value']);
  const formatted = text(p['formatted']);
  const skal = text(p['skal']);
  const unit = text(p['unit']);
  const mal = text(p['mal']);
  if (value === null || formatted === null || skal === null) return null;
  if (unit === null || mal === null) return null;
  // Målet provas mot MOTORNS lista, inte mot en kopia här.
  if (!arAvrundningsmal(mal)) return null;
  return { value, formatted, unit, skal, mal };
}

function lasResultat(v: unknown): Resultat | null {
  const r = post(v);
  if (!r) return null;
  const value = tal(r['value']);
  const unit = text(r['unit']);
  const formatted = text(r['formatted']);
  if (value === null || unit === null || formatted === null) return null;

  const villkor = strangar(r['villkor']);
  const praktiskt = lasPraktiskt(r['praktiskt']);
  const exakt = lasExakt(r['exakt']);
  const fakta = Array.isArray(r['fakta']) ? r['fakta'].flatMap(lasFaktum) : [];
  const rader = Array.isArray(r['rader']) ? r['rader'].flatMap(lasRad) : [];
  const andringsbart = strangar(r['andringsbart']).filter(arFaktumnyckel);

  return {
    value,
    unit,
    formatted,
    steps: Array.isArray(r['steps']) ? r['steps'].flatMap(lasSteg) : [],
    // Äldre svar saknar betydelsen; då visar appen etiketten den redan fått.
    betydelse: text(r['betydelse']) ?? '',
    ...(villkor.length > 0 ? { villkor } : {}),
    ...(praktiskt ? { praktiskt } : {}),
    ...(exakt ? { exakt } : {}),
    ...(fakta.length > 0 ? { fakta } : {}),
    ...(rader.length > 0 ? { rader } : {}),
    ...(andringsbart.length > 0 ? { andringsbart } : {}),
  };
}

/** Ett val vid tvetydighet. Utan titel är valet inget val. */
function lasVal(v: unknown, i: number): Val[] {
  const o = post(v);
  if (!o) return [];
  const titel = text(o['titel']);
  if (titel === null || titel.trim() === '') return [];
  return [
    {
      id: text(o['id']) ?? `val${i + 1}`,
      titel: titel.trim(),
      under: text(o['under'])?.trim() ?? '',
    },
  ];
}

const FELTYPER: readonly Feltyp[] = [
  'server', 'rate_limited', 'unparseable', 'unsupported', 'invalid_input',
];

/** Läser tjänstens svar. Allt som inte stämmer blir 'kunde-inte-tolka'. */
export function lasSvar(v: unknown): Tolkningssvar {
  const avbrutet: Tolkningssvar = { sort: 'fel', fel: 'kunde-inte-tolka' };
  const d = post(v);
  if (!d) return avbrutet;

  if (d['sort'] === 'fel') {
    const sort = d['fel'];
    const fel =
      sort === 'ingen-anslutning' || sort === 'for-manga-forsok' || sort === 'kunde-inte-tolka'
        ? sort
        : 'kunde-inte-tolka';
    const typ = text(d['typ']);
    const meddelande = text(d['meddelande'])?.trim();
    const forslag = strangar(d['forslag'])
      .map((f) => f.trim())
      .filter((f) => f !== '');
    const retryAfter = tal(d['retryAfter']);
    return {
      sort: 'fel',
      fel,
      ...(typ !== null && FELTYPER.includes(typ as Feltyp) ? { typ: typ as Feltyp } : {}),
      ...(meddelande !== undefined && meddelande !== '' ? { meddelande } : {}),
      ...(forslag.length > 0 ? { forslag } : {}),
      ...(retryAfter !== null ? { retryAfter } : {}),
    };
  }

  if (d['sort'] === 'foljdfraga') {
    const fraga = text(d['fraga']);
    const enhet = text(d['enhet']);
    if (fraga === null || fraga.trim() === '' || enhet === null) return avbrutet;
    const reason = text(d['reason'])?.trim();
    const forslag = text(d['forslag']);
    const choices = Array.isArray(d['choices']) ? d['choices'].flatMap(lasVal) : [];
    return {
      sort: 'foljdfraga',
      fraga,
      enhet,
      ...(forslag !== null ? { forslag } : {}),
      ...(reason !== undefined && reason !== '' ? { reason } : {}),
      // Ett ensamt val är ingen valsituation: då är det ett vanligt fält.
      ...(choices.length >= 2 ? { choices } : {}),
      ...(d['kant'] !== undefined ? { kant: d['kant'] } : {}),
    };
  }

  if (d['sort'] === 'svar') {
    const resultat = lasResultat(d['resultat']);
    const forklaring = text(d['forklaring']);
    if (!resultat || forklaring === null) return avbrutet;
    return {
      sort: 'svar',
      etikett: text(d['etikett']) ?? resultat.betydelse,
      resultat,
      forklaring,
    };
  }

  return avbrutet;
}

/**
 * Tolkaren mot API:et.
 *
 * Allt som hindrar ett svar — inget nät, ingen adress, fel statuskod, tidsgräns
 * — blir 'ingen-anslutning' (vy 06a). Att tjänsten svarade men inte kunde tolka
 * frågan blir 'kunde-inte-tolka' (vy 06b). Det är skillnaden användaren bryr
 * sig om: försöka igen, eller skriva om frågan.
 */
export const apiTolkare: Tolkare = {
  async tolka(fraga, kontext): Promise<Tolkningssvar> {
    if (!kontext.harNat || API_URL === null) {
      return { sort: 'fel', fel: 'ingen-anslutning', typ: 'ingen-anslutning' };
    }

    // AbortSignal.timeout finns inte i alla Hermes-byggen. Gör det för hand.
    const styrning = new AbortController();
    const klocka = setTimeout(() => styrning.abort(), TIDSGRANS_MS);

    try {
      const svar = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          fraga,
          // Servern vill ha en LISTA: hela kedjan av svar, inte bara det
          // senaste. Appen skickade tidigare ett ensamt objekt, vilket gav
          // 400 på varje följdfråga.
          ...(kontext.foljdsvar && kontext.foljdsvar.length > 0
            ? { foljdsvar: kontext.foljdsvar.slice(-4) }
            : {}),
          ...(kontext.tidigareTolkning !== undefined
            ? { tidigareTolkning: kontext.tidigareTolkning }
            : {}),
        }),
        signal: styrning.signal,
      });

      // Taket per IP. Egen vy-text: att vänta är rätt handling, inte att
      // skriva om frågan.
      if (svar.status === 429) {
        const sekunder = Number(svar.headers.get('Retry-After'));
        return {
          sort: 'fel',
          fel: 'for-manga-forsok',
          typ: 'rate_limited',
          ...(Number.isFinite(sekunder) && sekunder > 0 ? { retryAfter: sekunder } : {}),
        };
      }

      if (!svar.ok) {
        // 400 betyder att appen skickade något fel: visa inte "skriv om frågan".
        return { sort: 'fel', fel: 'ingen-anslutning', typ: 'server' };
      }
      return lasSvar(await svar.json());
    } catch {
      return { sort: 'fel', fel: 'ingen-anslutning', typ: 'ingen-anslutning' };
    } finally {
      clearTimeout(klocka);
    }
  },
};
