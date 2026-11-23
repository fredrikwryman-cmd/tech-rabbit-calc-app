/**
 * Formatering i svensk stil, utan Intl.
 *
 * Intl saknas eller skiljer sig mellan Hermes-byggen, så formateringen görs
 * för hand. Det ger samma sträng i motorn, i testerna och i appen.
 */

/** Tusentalsavgränsare: hårt mellanslag, så talet aldrig bryts över två rader. */
export const TUSENAVSKILJARE = ' ';
export const DECIMALTECKEN = ',';

const MAX_DECIMALER = 2;

/**
 * Formaterar ett tal i svensk stil: decimalkomma och mellanslag som
 * tusentalsavgränsare.
 *
 * @param varde  talet
 * @param decimaler  exakt antal decimaler. Utan värde: upp till två, och
 *                   avslutande nollor tas bort (7000 → "7 000").
 */
export function formatTal(varde: number, decimaler?: number): string {
  if (!Number.isFinite(varde)) return '–';

  const fast = decimaler !== undefined;
  const d = fast ? Math.max(0, Math.trunc(decimaler)) : MAX_DECIMALER;

  const absolut = Math.abs(varde).toFixed(d);
  const punkt = absolut.indexOf('.');
  const heltal = punkt === -1 ? absolut : absolut.slice(0, punkt);
  let decimal = punkt === -1 ? '' : absolut.slice(punkt + 1);
  if (!fast) decimal = decimal.replace(/0+$/, '');

  const grupperat = heltal.replace(/\B(?=(\d{3})+(?!\d))/g, TUSENAVSKILJARE);
  // "-0" ska inte uppstå av avrundning
  const negativt = varde < 0 && Number(absolut) !== 0;

  return `${negativt ? '-' : ''}${grupperat}${decimal ? DECIMALTECKEN + decimal : ''}`;
}

/** Tal plus enhet, med mellanslag emellan. Procent skrivs också med mellanslag. */
export function formatMangd(varde: number, enhet: string, decimaler?: number): string {
  return `${formatTal(varde, decimaler)}${TUSENAVSKILJARE}${enhet}`;
}
