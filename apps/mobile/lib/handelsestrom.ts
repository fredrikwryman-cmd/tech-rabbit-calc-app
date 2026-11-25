/**
 * Händelseströmmen på Hem, rev-ux 2.1 punkt 3.
 *
 * Verktyg och kalkyl har historiken som ström: de senaste uträkningarna
 * ligger direkt under frågefältet, och "Visa alla" sist går till Historik.
 * Ren funktion, utan React: lika testbar som den är liten.
 */

/** Hur många rader strömmen visar. rev-ux säger minst 3. */
export const STROMLANGD = 3;

/**
 * De senaste posterna, nyast först.
 *
 * Historiken sparas redan nyast först (app-state lägger till i början), så
 * funktionen skär bara av — den sorterar inte om, för då skulle en post med
 * ett trasigt datum hoppa i listan.
 */
export function senasteUtrakningar<T>(
  historik: readonly T[],
  antal: number = STROMLANGD,
): readonly T[] {
  if (antal <= 0) return [];
  return historik.slice(0, antal);
}

/** Sant när blocket ska ritas alls. Tom historik ger inget block. */
export function visaStrom(historik: readonly unknown[]): boolean {
  return historik.length > 0;
}

/** Sant när "Visa alla" tillför något: det finns mer än strömmen visar. */
export function visaAlla(historik: readonly unknown[], antal: number = STROMLANGD): boolean {
  return historik.length > antal;
}
