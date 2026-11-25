/**
 * Historiken grupperad per dag, rev-ux 4.3 punkt 5 (direktiv 41 steg 3).
 *
 * "Klistriga datumrubriker i listor." Rubrikerna heter samma sak som i
 * chatten — Idag, Igår, 8 jul — och kommer ur samma funktion
 * (`datumrubrik` i lib/chatt-trad.ts), så de två listorna i appen aldrig kan
 * börja säga olika saker om samma dag.
 *
 * Ren funktion utan React: ordningen och gränserna går att testa i Node.
 */

import { datumrubrik } from './chatt-trad.ts';

/** Det grupperingen behöver veta om en post. Resten rör den inte. */
export interface Daterad {
  /** ISO 8601. */
  readonly datum: string;
}

export interface Dagsgrupp<P> {
  /** "Idag", "Igår" eller "8 jul". */
  readonly rubrik: string;
  /** Dygnsnumret, som nyckel. Stabilt över en omrendering. */
  readonly nyckel: string;
  readonly poster: readonly P[];
}

/** Dygnsnumret i telefonens egen tidszon, så dygnsbyten hamnar rätt. */
function dag(d: Date): number | null {
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000);
}

/**
 * Posterna i dagsgrupper, i samma ordning som de kom in.
 *
 * Historiken sparas nyast först, och ordningen behålls: en post med ett
 * trasigt datum ska inte kunna hoppa i listan. En sådan post hamnar i en
 * grupp utan rubrik, sist — den ska synas, inte försvinna, och den har
 * ingen dag att stå under.
 */
export function grupperaPaDag<P extends Daterad>(
  poster: readonly P[],
  nu: Date = new Date(),
): readonly Dagsgrupp<P>[] {
  const ut: Dagsgrupp<P>[] = [];
  const utan: P[] = [];
  let senaste: number | null = null;

  for (const post of poster) {
    const d = dag(new Date(post.datum));
    if (d === null) {
      utan.push(post);
      continue;
    }
    const sist = ut[ut.length - 1];
    if (sist !== undefined && d === senaste) {
      ut[ut.length - 1] = { ...sist, poster: [...sist.poster, post] };
      continue;
    }
    senaste = d;
    ut.push({
      rubrik: datumrubrik(new Date(post.datum).getTime(), nu),
      nyckel: `d${d}`,
      poster: [post],
    });
  }

  if (utan.length > 0) ut.push({ rubrik: '', nyckel: 'utan-datum', poster: utan });
  return ut;
}

/**
 * Vilka barn i listan som är rubriker, för `stickyHeaderIndices`.
 *
 * Listan ritas som rubrik, kort, rubrik, kort … så rubrikerna ligger på
 * varannan plats. Funktionen finns för att räkningen ska stå EN gång och
 * gå att testa, i stället för att vara en uträkning inne i en vy.
 */
export function rubrikplatser(antalGrupper: number): readonly number[] {
  const ut: number[] = [];
  for (let i = 0; i < antalGrupper; i += 1) ut.push(i * 2);
  return ut;
}
