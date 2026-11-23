/**
 * Vilken resultatvy ett svar ska visas i (vyerna 30–33 i design v4).
 *
 * ## Varför vyn väljs ur motorns fakta
 *
 * Svaret från tjänsten bär inte vilket räknesätt som användes — `Svar` har
 * etikett, resultat och förklaring, och inget mer (lib/tolkning.ts). Men
 * motorn märker varje tal den räknat fram med en faktumnyckel, och de
 * nycklarna ÄR räknesättets signatur: bara `comparePrices` lämnar
 * `perEnhet` och `skillnad`, bara `splitCost` lämnar `perPerson`, bara
 * `packages` lämnar `forpackningar` och bara `workTime` lämnar `arbetstid`.
 *
 * Att läsa fakta i stället för att be tjänsten om ett nytt fält har två
 * fördelar: appen behöver inget nytt API, och en sparad uträkning i
 * historiken väljer samma vy som när den räknades — så länge fakta följde med
 * i lagringen.
 *
 * Allt här är rena funktioner på motorns `Resultat`. Inget React, inget nät.
 */

import type { Faktumnyckel, Rad, Resultat } from '@techrabbit/engine';

export type Vysort =
  /** Vy 30: två eller fler varor med jämförpris. */
  | 'jamforpris'
  /** Vy 31: delade kostnader och överföringar. */
  | 'dela'
  /** Vy 32: förpackningar och svinn. */
  | 'forpackningar'
  /** Vy 33: arbetad tid. */
  | 'arbetstid'
  /** Alla andra räknesätt: vy 05 som förut. */
  | 'standard';

function harNyckel(resultat: Resultat, nyckel: Faktumnyckel): boolean {
  return (resultat.fakta ?? []).some((f) => f.nyckel === nyckel);
}

function faktum(resultat: Resultat, nyckel: Faktumnyckel): Rad | null {
  const f = (resultat.fakta ?? []).find((x) => x.nyckel === nyckel);
  return f === undefined
    ? null
    : { etikett: f.betydelse, formatted: f.formatted, unit: f.unit, value: f.value };
}

/**
 * Vyn svaret ska visas i.
 *
 * Ordningen spelar roll bara om två räknesätt skulle dela en nyckel. I dag
 * gör de inte det, och nycklarna prövas i vyernas ordning så att ett framtida
 * räknesätt inte tyst kapar en vy som redan finns.
 *
 * `timeShift` (direktiv 30) lämnar `restid`, `avresa` och `ankomst` och
 * hamnar därför i 'standard'. Det är avsiktligt: designen har ingen vy 34,
 * och ett klockslag är ett svar vy 05 visar bra — talet står i `formatted`
 * och enheten är tom. Ingen nyckel ska läggas till här för den.
 */
export function valjVy(resultat: Resultat): Vysort {
  if (harNyckel(resultat, 'perEnhet') && harNyckel(resultat, 'skillnad')) return 'jamforpris';
  if (harNyckel(resultat, 'perPerson')) return 'dela';
  if (harNyckel(resultat, 'forpackningar')) return 'forpackningar';
  if (harNyckel(resultat, 'arbetstid')) return 'arbetstid';
  return 'standard';
}

// ---------------------------------------------------------------------------
// Vy 30
// ---------------------------------------------------------------------------

export interface Jamforvara {
  /** "A", "B" eller namnet frågan gav varan. */
  readonly namn: string;
  /** "750 g för 49,00 kr" — mängden och priset, som raden bär dem. */
  readonly beskrivning: string;
  /** Jämförpriset, färdigt att visa. */
  readonly varde: string;
  /** "kr/kg". */
  readonly enhet: string;
  readonly value: number;
  readonly billigast: boolean;
}

export interface Jamforelse {
  readonly varor: readonly Jamforvara[];
  /** "2,83" — skillnaden per enhet. */
  readonly skillnad: string;
  /** "4,3" — skillnaden i procent. */
  readonly procent: string;
  /** Raden under korten, ur motorns villkor. */
  readonly rad: string;
}

/** Varorna och skillnaden ur ett comparePrices-resultat. */
export function jamforelse(resultat: Resultat): Jamforelse | null {
  const rader = resultat.rader ?? [];
  if (rader.length < 2) return null;
  const lagsta = Math.min(...rader.map((r) => r.value));
  const varor = rader.map((r) => {
    // Etiketten är "A: 750 g för 49,00 kr". Namnet står före kolon.
    const vid = r.etikett.indexOf(':');
    const namn = vid === -1 ? r.etikett : r.etikett.slice(0, vid).trim();
    const beskrivning = vid === -1 ? '' : r.etikett.slice(vid + 1).trim();
    return {
      namn,
      beskrivning,
      varde: r.formatted,
      enhet: r.unit,
      value: r.value,
      billigast: r.value === lagsta,
    };
  });
  const skillnad = faktum(resultat, 'skillnad');
  const andel = faktum(resultat, 'andel');
  return {
    varor,
    skillnad: skillnad?.formatted ?? '',
    procent: andel?.formatted ?? '',
    rad: resultat.villkor?.[0] ?? '',
  };
}

// ---------------------------------------------------------------------------
// Vy 31
// ---------------------------------------------------------------------------

export interface Delperson {
  readonly namn: string;
  /** "900,00 kr", eller tom sträng när utläggen inte är kända. */
  readonly betalat: string;
  /** Vad personen ska bära, lika för alla. */
  readonly skaBara: string;
  readonly enhet: string;
}

export interface Overforing {
  readonly fran: string;
  readonly till: string;
  readonly belopp: string;
  readonly enhet: string;
}

export interface Delning {
  readonly personer: readonly Delperson[];
  readonly overforingar: readonly Overforing[];
  /** "1 200,00" — hela kostnaden. */
  readonly totalt: string;
  readonly enhet: string;
  /** Vad var och en ska bära. */
  readonly perPerson: string;
}

/** Personerna och överföringarna ur ett splitCost-resultat. */
export function delning(resultat: Resultat): Delning | null {
  const perPerson = faktum(resultat, 'perPerson');
  if (perPerson === null) return null;
  const rader = resultat.rader ?? [];
  const personer: Delperson[] = [];
  const overforingar: Overforing[] = [];

  for (const r of rader) {
    // Överföringsraden är "C betalar A", personraden "A: betalat 900,00 kr".
    const betalning = /^(.+?) betalar (.+)$/u.exec(r.etikett);
    if (betalning !== null) {
      overforingar.push({
        fran: (betalning[1] ?? '').trim(),
        till: (betalning[2] ?? '').trim(),
        belopp: r.formatted,
        enhet: r.unit,
      });
      continue;
    }
    const vid = r.etikett.indexOf(':');
    const namn = vid === -1 ? r.etikett.trim() : r.etikett.slice(0, vid).trim();
    const efter = vid === -1 ? '' : r.etikett.slice(vid + 1).trim();
    // "betalat 900,00 kr" → beloppet utan ordet.
    const betalat = /^betalat\s+(.+)$/iu.exec(efter)?.[1] ?? '';
    personer.push({ namn, betalat, skaBara: r.formatted, enhet: r.unit });
  }

  const total = faktum(resultat, 'belopp');
  return {
    personer,
    overforingar,
    totalt: total?.formatted ?? '',
    enhet: perPerson.unit,
    perPerson: perPerson.formatted,
  };
}

/**
 * Huvudsvaret delningsbilden ska visa (direktiv 25).
 *
 * Bilden visade motorns `formatted`, alltså beloppet per person, medan
 * skärmen visade antalet överföringar. Samma svar ska stå på båda ställena,
 * så vy 31 räknar om huvudsvaret här — på exakt samma sätt som vyn gör det.
 */
export function delningsbildensHuvudsvar(
  resultat: Resultat,
  etikett: string,
): { etikett: string; varde: string; enhet: string } {
  if (valjVy(resultat) === 'dela') {
    const d = delning(resultat);
    const antal = d?.overforingar.length ?? 0;
    if (antal > 0) {
      return {
        etikett,
        varde: String(antal),
        enhet: antal === 1 ? 'överföring' : 'överföringar',
      };
    }
  }
  return { etikett, varde: resultat.formatted, enhet: resultat.unit };
}

/**
 * Raderna delningsbilden ska bära (direktiv 24).
 *
 * Vy 31 delar inte bara en siffra utan en uppgörelse: "C → A betalar 400 kr".
 * Bilden visar därför samma huvudsvar som skärmen plus överföringarna. Andra
 * räknesätt har inget motsvarande, och får en tom lista.
 */
export function delningsbildensRader(
  resultat: Resultat,
): readonly { etikett: string; varde: string }[] {
  if (valjVy(resultat) !== 'dela') return [];
  const d = delning(resultat);
  if (d === null) return [];
  return d.overforingar.map((o) => ({
    etikett: `${o.fran} → ${o.till} betalar`,
    varde: `${o.belopp} ${o.enhet}`,
  }));
}

// ---------------------------------------------------------------------------
// Vy 32
// ---------------------------------------------------------------------------

export interface Forpackningsdel {
  readonly etikett: string;
  readonly varde: string;
  readonly enhet: string;
  readonly value: number;
  /** Andel av den köpta mängden, 0–1. Stapelns bredd. */
  readonly andel: number;
}

export interface Forpackningar {
  /** Antal förpackningar, huvudsvaret. */
  readonly antal: string;
  /** "paket", "rullar" … */
  readonly namn: string;
  readonly behov: Forpackningsdel;
  /** Null när frågan inte nämnde något svinn. */
  readonly svinn: Forpackningsdel | null;
  readonly overskott: Forpackningsdel;
  /** "26,4" — hela den köpta mängden. */
  readonly totalt: string;
  readonly enhet: string;
  /** Varför antalet avrundades uppåt. */
  readonly skal: string;
}

/**
 * Delarna ur ett packages-resultat.
 *
 * Den köpta mängden räknas inte om här: behov + svinn + överskott ÄR den
 * köpta mängden, eftersom motorn räknade överskottet som skillnaden mellan
 * det köpta och behovet med svinn.
 */
export function forpackningar(resultat: Resultat): Forpackningar | null {
  const antal = faktum(resultat, 'forpackningar');
  const behov = faktum(resultat, 'mangd');
  const overskott = faktum(resultat, 'overskott');
  if (antal === null || behov === null || overskott === null) return null;
  const svinn = faktum(resultat, 'svinn');
  const svinnVarde = svinn !== null && svinn.value > 0 ? svinn : null;
  const totalt = behov.value + (svinnVarde?.value ?? 0) + overskott.value;
  const del = (r: Rad): Forpackningsdel => ({
    etikett: r.etikett,
    varde: r.formatted,
    enhet: r.unit,
    value: r.value,
    andel: totalt > 0 ? r.value / totalt : 0,
  });

  // Etiketten på svinnraden bär procenten: "Svinn 10 %".
  const svinnrad = (resultat.rader ?? []).find((r) => r.etikett.startsWith('Svinn'));

  return {
    antal: antal.formatted,
    namn: antal.unit,
    behov: del(behov),
    svinn: svinnVarde === null ? null : del({ ...svinnVarde, etikett: svinnrad?.etikett ?? 'Svinn' }),
    overskott: del(overskott),
    totalt: formatEnDecimal(totalt),
    enhet: behov.unit,
    skal: resultat.exakt?.skal ?? '',
  };
}

/** En decimal i svensk stil. Samma form som motorns egna radvärden. */
function formatEnDecimal(varde: number): string {
  return varde.toFixed(1).replace('.', ',');
}

// ---------------------------------------------------------------------------
// Vy 33
// ---------------------------------------------------------------------------

export interface Arbetspass {
  readonly namn: string;
  readonly start: string;
  readonly slut: string;
  /** "30", eller tom sträng när passet inte hade rast. */
  readonly rast: string;
  /** "8 h 15 min". */
  readonly tid: string;
}

export interface Arbetstid {
  readonly pass: readonly Arbetspass[];
  /**
   * Vad frågan frågade efter, och därmed vad som står stort (direktiv 24).
   * Motorn har redan valt: `unit` är tom när tiden är svaret.
   */
  readonly huvudsvar: 'tid' | 'lon';
  /** "8 h 15 min" — arbetad tid i summa. */
  readonly total: string;
  /** Lönen, när timlönen stod i frågan. */
  readonly lon: string | null;
  readonly lonEnhet: string;
  readonly timlon: string | null;
}

/**
 * Passen ur ett workTime-resultat.
 *
 * Klockslagen står i stegens uttryck ("07:30–16:15 − 30 min rast"), inte som
 * fakta: motorn räknar i minuter, och ett klockslag är ingen mängd. De läses
 * därför ur stegen. Går ett steg inte att läsa hoppas det över — hellre en
 * tidslinje som saknar ett pass än en rad som ljuger.
 */
export function arbetstid(resultat: Resultat): Arbetstid | null {
  const tid = faktum(resultat, 'arbetstid');
  if (tid === null) return null;
  const lon = faktum(resultat, 'lon');
  const timlon = faktum(resultat, 'timmar');

  const pass: Arbetspass[] = [];
  for (const steg of resultat.steps) {
    const klockor = /(\d{1,2}[:.]\d{2})\s*[–—-]\s*(\d{1,2}[:.]\d{2})/u.exec(steg.uttryck);
    if (klockor === null) continue;
    pass.push({
      namn: steg.etikett,
      start: klockor[1] ?? '',
      slut: klockor[2] ?? '',
      rast: /(\d+)\s*min rast/u.exec(steg.uttryck)?.[1] ?? '',
      tid: steg.resultat,
    });
  }

  // Är lönen huvudsvaret står tiden i villkoret, och tvärtom.
  const urVillkor = (resultat.villkor ?? [])
    .map((v) => /^Arbetad tid (.+)$/u.exec(v)?.[1])
    .find((v): v is string => v !== undefined);

  return {
    pass,
    huvudsvar: resultat.unit === '' ? 'tid' : 'lon',
    total: urVillkor ?? resultat.formatted,
    lon: lon?.formatted ?? null,
    lonEnhet: lon?.unit ?? '',
    timlon: timlon?.formatted ?? null,
  };
}
