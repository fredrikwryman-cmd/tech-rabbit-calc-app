/**
 * Testerna för de fem sista räknesätten: rabatter, baklänges från ett mål,
 * återkommande kostnader, resekostnad och antal sålda för break-even.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  breakEvenUnits,
  discount,
  priceForTarget,
  RaknefelError,
  recurringCost,
  savingsPlan,
  tripCost,
} from '../src/index.ts';

// -------------------------------------------------------------- 1 rabatter

test('discount: 20 procent pa 500 kr', () => {
  const r = discount(500, { rabatter: [20] });
  assert.equal(r.formatted, '400,00');
  assert.equal(r.unit, 'kr');
  assert.equal(r.betydelse, 'Pris efter rabatt');
  assert.match(r.villkor?.[0] ?? '', /sparar 100,00 kr/u);
  assert.match(r.villkor?.[0] ?? '', /20,0 %/u);
});

test('discount: tva rabatter raknas efter varandra, inte ihopslagna', () => {
  const r = discount(500, { rabatter: [20, 10] });
  // 500 → 400 → 360. Ihopslaget (30 %) hade gett 350.
  assert.equal(r.formatted, '360,00');
  assert.equal(r.rader?.length, 2);
  assert.ok((r.villkor ?? []).some((v) => v.includes('efter varandra')));
});

test('discount: rabatt i kronor', () => {
  const r = discount(500, { rabatter: [50], sort: 'kronor' });
  assert.equal(r.formatted, '450,00');
});

test('discount: tre for tva ger styckpriset', () => {
  const r = discount(100, { far: 3, betalar: 2 });
  assert.equal(r.formatted, '66,67');
  assert.equal(r.unit, 'kr/st');
  assert.equal(r.betydelse, 'Pris per styck efter erbjudandet');
});

test('discount: rabatt och erbjudande tillsammans', () => {
  const r = discount(100, { rabatter: [10], far: 3, betalar: 2 });
  // 100 → 90, och 90 × 2 / 3 = 60.
  assert.equal(r.formatted, '60,00');
});

test('discount: kantfall - ingen rabatt, over 100 procent, rabatt storre an priset', () => {
  assert.throws(() => discount(500), RaknefelError);
  assert.throws(() => discount(500, { rabatter: [120] }), RaknefelError);
  assert.throws(() => discount(100, { rabatter: [200], sort: 'kronor' }), RaknefelError);
  assert.throws(() => discount(0, { rabatter: [10] }), RaknefelError);
  assert.throws(() => discount(100, { far: 2, betalar: 3 }), RaknefelError);
});

// ------------------------------------------------------- 2a baklanges, pris

test('priceForTarget: 25 kr vinst pa ett inkop for 80 kr', () => {
  const r = priceForTarget(80, 25, 'vinst');
  assert.equal(r.formatted, '105,00');
  assert.equal(r.betydelse, 'Försäljningspris');
  assert.match(r.villkor?.[0] ?? '', /23,8 % marginal/u);
});

test('priceForTarget: 30 procents marginal pa 80 kr', () => {
  const r = priceForTarget(80, 30, 'marginal');
  // 80 / 0,7 = 114,29 — inte 104, som ett pålägg hade gett.
  assert.equal(r.formatted, '114,29');
});

test('priceForTarget: kantfall - noll inkop, marginal 100 procent', () => {
  assert.throws(() => priceForTarget(0, 30, 'marginal'), RaknefelError);
  assert.throws(() => priceForTarget(80, 100, 'marginal'), RaknefelError);
  assert.throws(() => priceForTarget(80, 0, 'vinst'), RaknefelError);
});

// ------------------------------------------------------ 2b baklanges, spara

test('savingsPlan: 24 000 kr pa 12 manader', () => {
  const r = savingsPlan(24000, { manader: 12 });
  assert.equal(r.formatted, '2 000,00');
  assert.equal(r.unit, 'kr/mån');
  assert.match(r.villkor?.[0] ?? '', /12 månader/u);
});

test('savingsPlan: redan sparat dras av', () => {
  const r = savingsPlan(10000, { manader: 4, redan: 2000 });
  assert.equal(r.formatted, '2 000,00');
});

test('savingsPlan: beloppet avrundas uppat sa hela malet nas', () => {
  const r = savingsPlan(1000, { manader: 3 });
  // 333,333… → 333,34 per månad, annars saknas ett öre på slutet.
  assert.equal(r.formatted, '333,34');
  assert.equal(r.exakt?.formatted, '333,33');
  assert.match(r.exakt?.skal ?? '', /uppåt/u);
});

test('savingsPlan: datum raknas om till manader', () => {
  const r = savingsPlan(12000, { datum: '2027-01-01', idag: new Date('2026-01-01T00:00:00Z') });
  assert.match(r.villkor?.[0] ?? '', /12 månader/u);
  assert.equal(r.formatted, '1 000,00');
});

test('savingsPlan: kantfall - inget datum, datum som varit, redan i mal', () => {
  assert.throws(() => savingsPlan(1000), RaknefelError);
  assert.throws(
    () => savingsPlan(1000, { datum: '2020-01-01', idag: new Date('2026-01-01T00:00:00Z') }),
    RaknefelError,
  );
  assert.throws(() => savingsPlan(1000, { manader: 3, redan: 1000 }), RaknefelError);
  assert.throws(() => savingsPlan(1000, { datum: 'i juni' }), RaknefelError);
});

// --------------------------------------------- 3 aterkommande kostnader

test('recurringCost: 99 kr i manaden och 1 200 kr om aret, per ar', () => {
  const r = recurringCost(
    [
      { belopp: 99, period: 'manad', namn: 'Strömning' },
      { belopp: 1200, period: 'ar', namn: 'Försäkring' },
    ],
    'ar',
  );
  // 99 × 12 = 1 188, plus 1 200 = 2 388.
  assert.equal(r.formatted, '2 388,00');
  assert.equal(r.unit, 'kr/år');
  assert.equal(r.rader?.length, 2);
});

test('recurringCost: en kostnad per manad omraknad till ar', () => {
  const r = recurringCost([{ belopp: 100, period: 'manad' }], 'ar');
  assert.equal(r.formatted, '1 200,00');
  assert.equal(r.rader, undefined);
});

test('recurringCost: veckor och dagar raknas via aret', () => {
  const r = recurringCost([{ belopp: 52, period: 'vecka' }], 'ar');
  assert.equal(r.formatted, '2 704,00');
  const dag = recurringCost([{ belopp: 365, period: 'dag' }], 'ar');
  assert.equal(dag.formatted, '133 225,00');
});

test('recurringCost: kantfall - tom lista och negativt belopp', () => {
  assert.throws(() => recurringCost([], 'ar'), RaknefelError);
  assert.throws(() => recurringCost([{ belopp: -10, period: 'manad' }], 'ar'), RaknefelError);
});

// ---------------------------------------------------------- 4 resekostnad

test('tripCost: 300 km, 6 l per 100 km, 19,50 kr per liter', () => {
  const r = tripCost(300, 6, 19.5);
  // 18 liter × 19,50 = 351 kr.
  assert.equal(r.formatted, '351,00');
  assert.equal(r.betydelse, 'Resan kostar');
});

test('tripCost: tur och retur dubblar strackan', () => {
  const r = tripCost(300, 6, 19.5, { turOchRetur: true });
  assert.equal(r.formatted, '702,00');
  assert.match(r.villkor?.[0] ?? '', /tur och retur/u);
});

test('tripCost: delat pa fyra ger bade hela resan och per person', () => {
  const r = tripCost(300, 6, 19.5, { personer: 4 });
  assert.equal(r.formatted, '87,75');
  assert.equal(r.betydelse, 'Per person');
  assert.equal(r.rader?.length, 2);
  assert.equal(r.rader?.[0]?.formatted, '351,00');
});

test('tripCost: el raknas likadant med kWh', () => {
  const r = tripCost(200, 18, 2.5, { enhet: 'kWh' });
  // 36 kWh × 2,50 = 90 kr.
  assert.equal(r.formatted, '90,00');
  assert.match(r.villkor?.[1] ?? '', /kWh per 100 km/u);
});

test('tripCost: kantfall - noll stracka, noll pris, noll forbrukning', () => {
  assert.throws(() => tripCost(0, 6, 19.5), RaknefelError);
  assert.throws(() => tripCost(300, 0, 19.5), RaknefelError);
  assert.throws(() => tripCost(300, 6, 0), RaknefelError);
});

// ------------------------------------------------------- 5 break-even i st

test('breakEvenUnits: 12 000 kr fast, 250 kr pris, 100 kr kostnad', () => {
  const r = breakEvenUnits(12000, 250, 100);
  // Täckningsbidrag 150 kr, 12 000 / 150 = 80 st.
  assert.equal(r.formatted, '80');
  assert.equal(r.unit, 'st');
  assert.equal(r.exakt?.value, 80);
});

test('breakEvenUnits: avrundar uppat nar det inte gar jamnt ut', () => {
  const r = breakEvenUnits(1000, 100, 70);
  // 1000 / 30 = 33,33 → 34 st.
  assert.equal(r.formatted, '34');
  assert.equal(r.exakt?.formatted, '33,33');
  assert.match(r.exakt?.skal ?? '', /uppåt/u);
});

test('breakEvenUnits: kantfall - priset tacker inte kostnaden', () => {
  assert.throws(() => breakEvenUnits(1000, 100, 100), RaknefelError);
  assert.throws(() => breakEvenUnits(1000, 80, 100), RaknefelError);
  assert.throws(() => breakEvenUnits(0, 100, 50), RaknefelError);
  assert.throws(() => breakEvenUnits(1000, 100, -5), RaknefelError);
});
