/**
 * Det levande talet, rev-ux A10 och avsnitt 8.3.
 *
 * Rena funktioner, utan React och utan React Native: komponenten
 * komponenter/LevandeTal.tsx ritar, den här filen räknar. Det är också det
 * enda sättet att testa logiken — tester/ kör ren Node.
 *
 * Huvudsvaret rullar in siffra för siffra och KRYMPER när talet blir långt.
 * Det får aldrig klippas: ett svar man inte kan läsa är inget svar.
 */

/**
 * Hur mycket talet krymper vid en viss längd.
 *
 * Trappan är rev-ux 8.3: över 9 tecken 0,64 och över 6 tecken 0,8. Stegen
 * ligger där tusentalsavgränsarna hamnar i svensk formatering ("1 234 567"),
 * så ett tal växer aldrig ur kortet mellan två steg.
 */
export function krympfaktor(langd: number): number {
  if (langd > 12) return 0.5;
  if (langd > 9) return 0.64;
  if (langd > 6) return 0.8;
  return 1;
}

/** Talets storlek i punkter vid en given grundstorlek. */
export function talstorlek(grundstorlek: number, text: string): number {
  return Math.round(grundstorlek * krympfaktor([...text].length));
}

export interface Taltecken {
  /**
   * Nyckeln som avgör om tecknet är SAMMA tecken som förra gången.
   *
   * Positionen räknas från HÖGER, så att ett tal som växer från 999 till
   * 1 000 inte byter nyckel på varje siffra och rullar om hela raden — bara
   * den nya siffran längst till vänster kommer in.
   */
  readonly nyckel: string;
  readonly tecken: string;
  /** Sant för en siffra. Avgränsare och komma rullar inte, de skjuts in. */
  readonly siffra: boolean;
}

/**
 * Talet som tecken, redo att ritas ett och ett.
 *
 * Mellanslag i svenska tusental är hårda blanksteg (U+00A0) från
 * formateringen. De behåller sitt tecken: det är en avgränsare, inte text
 * som ska brytas.
 */
export function tecken(varde: string): readonly Taltecken[] {
  const lista = [...varde];
  const sista = lista.length - 1;
  return lista.map((t, i) => ({
    nyckel: `${sista - i}-${t}`,
    tecken: t,
    siffra: /\p{Nd}/u.test(t),
  }));
}
