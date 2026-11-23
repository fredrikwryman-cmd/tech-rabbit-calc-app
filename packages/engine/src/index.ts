/**
 * Tech Rabbit AI Kalkylator — räknemotorn.
 *
 * Ren TypeScript utan beroenden. AI:n tolkar frågan till strukturerad data och
 * förklarar svaret efteråt. All räkning sker här, och bara här.
 */

export { arithmetic } from './aritmetik.ts';
export {
  arAvrundningsmal,
  AVRUNDNINGSMAL,
  type Avrundningsmal,
  type Praktiskt,
  praktisktVarde,
  stegdecimaler,
  tackerMalet,
  valutasteg,
} from './avrundning.ts';
export { breakEven, convert, interest, margin } from './berakningar.ts';
export {
  hourlyRate,
  markup,
  MOMS_NORMALSATS,
  MOMSSATSER,
  type Momsrakning,
  percentChange,
  percentOf,
  priceFromMargin,
  vat,
} from './ekonomi.ts';
export type { BreakEvenAlternativ, MangdEllerTal } from './berakningar.ts';
export type { KonverteraAlternativ } from './konvertera.ts';
export { tillHuvudenhet } from './konvertera.ts';
export {
  arBehov,
  arForpackningsenhet,
  type Behov,
  BEHOVER_PERPACKAGE,
  BEHOVER_TIMMAR,
  enheterPerDimension,
  FORPACKNINGSENHETER,
  type Forpackningsenhet,
  HUVUDENHET,
  type PerPackage,
  slaUppEnhet,
  TID_AR_DYGN,
  TID_MANAD_DYGN,
  type Enhet,
} from './enheter.ts';
export { DECIMALTECKEN, formatMangd, formatTal, TUSENAVSKILJARE } from './format.ts';
export {
  breakEvenUnits,
  discount,
  type DiscountAlternativ,
  type Kostnad,
  type Period,
  priceForTarget,
  recurringCost,
  savingsPlan,
  type SavingsPlanAlternativ,
  tripCost,
  type TripCostAlternativ,
} from './handel.ts';
export {
  type Arbetsdag,
  comparePrices,
  type ComparePricesAlternativ,
  formatArbetstid,
  formatKlockslag,
  packages,
  type PackagesAlternativ,
  splitCost,
  type SplitCostAlternativ,
  timeShift,
  type TimeShiftAlternativ,
  type Utlagg,
  type Vara,
  workTime,
  type WorkTimeAlternativ,
} from './vardag.ts';
export {
  arFaktumnyckel,
  type Dimension,
  type Faktum,
  FAKTUMNYCKLAR,
  type Faktumnyckel,
  type Mangd,
  type Rad,
  RaknefelError,
  type Raknefelkod,
  type Resultat,
  type Steg,
} from './typer.ts';
