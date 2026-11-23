/**
 * Chattens kärna: de delar som inte rör React Native.
 *
 * SSE-parsningen och tiden kvar till midnatt låg tidigare inuti chatt.ts,
 * tillsammans med AsyncStorage och XMLHttpRequest. De två delarna är ren
 * räkning på strängar och tal, och de är också de som kan gå sönder tyst.
 * Här är de utan beroenden, så att de går att testa med Nodes testkörare —
 * precis som räknemotorn.
 */

/** En händelse ur strömmen: `event:`-raden och dess `data:`-rad, tolkad. */
export interface Sshandelse {
  readonly namn: string;
  readonly kropp: Record<string, unknown>;
}

/**
 * Läser Server-Sent Events ur en text som växer.
 *
 * Servern skickar hela händelser, men nätet delar dem var som helst. En
 * händelse är slut vid en tom rad, så allt efter den sista tomma raden kan
 * vara halvt och sparas till nästa anrop. Läsaren är därför tillståndsbärande:
 * den minns hur långt in i texten den har läst.
 *
 * `las` tar HELA texten som kommit hittills (det XHR:s `responseText` ger),
 * inte bara det nya, och returnerar de händelser som tillkommit.
 */
export class Sselasare {
  #last = 0;

  las(allt: string): readonly Sshandelse[] {
    const slutetPaHel = allt.lastIndexOf('\n\n');
    if (slutetPaHel < this.#last) return [];
    const nytt = allt.slice(this.#last, slutetPaHel + 2);
    this.#last = slutetPaHel + 2;

    const ut: Sshandelse[] = [];
    for (const block of nytt.split('\n\n')) {
      const namn = /^event: (\w+)$/mu.exec(block)?.[1];
      const data = /^data: (.*)$/mu.exec(block)?.[1];
      if (namn === undefined || data === undefined) continue;
      let kropp: unknown;
      try {
        kropp = JSON.parse(data);
      } catch {
        // En halv eller trasig rad kastas. Ett avbrutet svar är bättre än ett
        // påhittat.
        continue;
      }
      if (typeof kropp !== 'object' || kropp === null) continue;
      ut.push({ namn, kropp: kropp as Record<string, unknown> });
    }
    return ut;
  }
}

/** En källa Rabbit AI slog upp på webben. */
export interface Kalla {
  readonly titel: string;
  readonly adress: string;
  readonly doman: string;
}

/** Högst så många källor visas. Servern skickar redan som mest åtta. */
const MAX_KALLOR = 8;

/**
 * Källorna ur en `kallor`-händelse.
 *
 * Servern är vår egen, men strömmen läses som vilken text som helst: en
 * trasig, halv eller främmande kropp ska ge en tom lista, aldrig en krasch
 * och aldrig en rad utan adress. Bara http och https släpps igenom, eftersom
 * raden öppnas med Linking — en annan sorts adress kan starta något annat i
 * telefonen. Dubbletter faller bort på adressen, och domänen räknas fram här
 * när servern inte skickade någon.
 */
export function kallorUr(kropp: Record<string, unknown>): readonly Kalla[] {
  const lista = kropp['kallor'];
  if (!Array.isArray(lista)) return [];
  const ut: Kalla[] = [];
  const sedda = new Set<string>();
  for (const post of lista) {
    if (typeof post !== 'object' || post === null) continue;
    const k = post as Record<string, unknown>;
    const adress = typeof k['adress'] === 'string' ? k['adress'].trim() : '';
    if (!/^https?:\/\//iu.test(adress)) continue;
    if (sedda.has(adress)) continue;
    const doman = typeof k['doman'] === 'string' && k['doman'].trim() !== ''
      ? k['doman'].trim()
      : domanUr(adress);
    if (doman === '') continue;
    const titel = typeof k['titel'] === 'string' && k['titel'].trim() !== ''
      ? k['titel'].trim()
      : doman;
    sedda.add(adress);
    ut.push({ titel, adress, doman });
    if (ut.length >= MAX_KALLOR) break;
  }
  return ut;
}

/** Domänen ur en adress, utan www. Tom sträng när den inte går att läsa. */
export function domanUr(adress: string): string {
  const traff = /^https?:\/\/([^/?#]+)/iu.exec(adress.trim());
  const varden = traff?.[1];
  if (varden === undefined) return '';
  // Portnummer och inloggning hör inte till domänen man visar.
  const utan = varden.split('@').pop() ?? '';
  return utan.split(':')[0]?.replace(/^www\./iu, '').toLowerCase() ?? '';
}

/** "6 h 12 min" — tiden kvar till midnatt, som i vy 21e. */
export function tidKvar(sekunder: number): string {
  if (!Number.isFinite(sekunder) || sekunder <= 0) return 'en stund';
  const h = Math.floor(sekunder / 3600);
  const m = Math.floor((sekunder % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return 'en stund';
}
