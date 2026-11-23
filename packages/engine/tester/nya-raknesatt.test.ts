/**
 * Tester för räknesätten som kom i direktiv 6.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  arBehov,
  arithmetic,
  breakEven,
  hourlyRate,
  markup,
  percentChange,
  percentOf,
  RaknefelError,
  vat,
} from '../src/index.ts';

// ---------------------------------------------------------------------------
// arithmetic: egen tolk, ingen eval
// ---------------------------------------------------------------------------

test('arithmetic: prioritet utan parenteser', () => {
  assert.equal(arithmetic('12 + 3 × 4').value, 24);
  assert.equal(arithmetic('100 − 10 ÷ 2').value, 95);
});

test('arithmetic: parenteser gar fore', () => {
  assert.equal(arithmetic('(12 + 3) × 4').value, 60);
  assert.equal(arithmetic('((2 + 3) × (4 + 1))').value, 25);
});

test('arithmetic: svenska tal, mellanslag och komma', () => {
  assert.equal(arithmetic('1 200 ÷ 3').value, 400);
  assert.equal(arithmetic('2,5 × 4').value, 10);
  assert.equal(arithmetic('1 000 000 ÷ 1 000').value, 1000);
});

test('arithmetic: alternativa tecken', () => {
  assert.equal(arithmetic('6 * 7').value, 42);
  assert.equal(arithmetic('84 / 2').value, 42);
  assert.equal(arithmetic('84 : 2').value, 42);
  assert.equal(arithmetic('50 - 8').value, 42);
});

test('arithmetic: unart minus', () => {
  assert.equal(arithmetic('−5 + 12').value, 7);
  assert.equal(arithmetic('3 × −4').value, -12);
});

test('arithmetic: enhet visas efter svaret', () => {
  const r = arithmetic('1 200 ÷ 3', 'kr');
  assert.equal(r.unit, 'kr');
  assert.equal(r.formatted, '400');
});

test('arithmetic: stegen visar ordningen rakningen utfordes i', () => {
  const r = arithmetic('12 + 3 × 4');
  // Multiplikationen forst, darfor ar den steg 1.
  assert.equal(r.steps[0]?.uttryck, '3 × 4');
  assert.equal(r.steps[1]?.uttryck, '12 + 12');
  assert.equal(r.formatted, '24');
});

test('arithmetic: division med noll ar ett rakneFel', () => {
  assert.throws(() => arithmetic('5 ÷ 0'), RaknefelError);
});

test('arithmetic: skrap avvisas i stallet for att gissas', () => {
  assert.throws(() => arithmetic('12 + '), RaknefelError);
  assert.throws(() => arithmetic('(12 + 3'), RaknefelError);
  assert.throws(() => arithmetic('12 ++ 3 apelsiner'), RaknefelError);
  assert.throws(() => arithmetic(''), RaknefelError);
});

test('arithmetic: inget kan smyga in korning av kod', () => {
  // Ett uttryck som vore farligt med eval ar bara ogiltigt har.
  assert.throws(() => arithmetic('process.exit(1)'), RaknefelError);
  assert.throws(() => arithmetic('1;console.log(2)'), RaknefelError);
});

// ---------------------------------------------------------------------------
// Procent
// ---------------------------------------------------------------------------

test('percentOf: andel av ett tal', () => {
  assert.equal(percentOf(25, 800).value, 200);
  assert.equal(percentOf(6, 50).value, 3);
  assert.equal(percentOf(25, 800, 'kr').unit, 'kr');
});

test('percentChange: okning och minskning', () => {
  assert.equal(percentChange(40, 65).value, 62.5);
  assert.equal(percentChange(100, 75).value, -25);
  assert.equal(percentChange(40, 65).unit, '%');
});

test('percentChange: fran noll gar inte', () => {
  assert.throws(() => percentChange(0, 50), RaknefelError);
});

// ---------------------------------------------------------------------------
// Moms
// ---------------------------------------------------------------------------

test('vat: lagga pa de tre svenska satserna', () => {
  assert.equal(vat(800, 25, 'lagg-pa').value, 1000);
  assert.equal(vat(100, 12, 'lagg-pa').value, 112);
  assert.equal(vat(100, 6, 'lagg-pa').value, 106);
});

test('vat: avdrag raknas som brutto delat med (1 + sats)', () => {
  assert.equal(vat(1000, 25, 'dra-av').value, 800);
  assert.equal(vat(112, 12, 'dra-av').value, 100);
  assert.equal(vat(106, 6, 'dra-av').value, 100);
  // Inte brutto minus sats procent av brutto: det hade gett 750, inte 800.
  assert.notEqual(vat(1000, 25, 'dra-av').value, 750);
});

test('vat: momsbeloppet pa netto och i brutto', () => {
  assert.equal(vat(800, 25, 'moms-pa-netto').value, 200);
  assert.equal(vat(1000, 25, 'moms-i-brutto').value, 200);
});

test('vat: lagga pa och dra av tar ut varandra', () => {
  const brutto = vat(800, 25, 'lagg-pa').value;
  assert.equal(vat(brutto, 25, 'dra-av').value, 800);
});

test('vat: avdragssteget visar delningen', () => {
  const r = vat(1000, 25, 'dra-av');
  assert.match(r.steps[0]?.uttryck ?? '', /1 000 ÷ 1,25/u);
});

// ---------------------------------------------------------------------------
// Paslag
// ---------------------------------------------------------------------------

test('markup: pris och marginalen paslaget ger', () => {
  const r = markup(40, 50);
  assert.equal(r.value, 60);
  // 50 % paslag ar 33,3 % marginal, inte 50 %.
  assert.equal(r.steps[2]?.resultat, '33,3 %');
});

test('markup: hundra procents paslag ger femtio procents marginal', () => {
  const r = markup(100, 100);
  assert.equal(r.value, 200);
  assert.equal(r.steps[2]?.resultat, '50,0 %');
});

test('markup: noll paslag ger noll marginal', () => {
  const r = markup(80, 0);
  assert.equal(r.value, 80);
  assert.equal(r.steps[2]?.resultat, '0,0 %');
});

// ---------------------------------------------------------------------------
// Timpris
// ---------------------------------------------------------------------------

test('hourlyRate: manadsmal delat pa timmar', () => {
  const r = hourlyRate(40_000, 160);
  assert.ok(!arBehov(r));
  if (!arBehov(r)) {
    assert.equal(r.value, 250);
    assert.equal(r.unit, 'kr/h');
  }
});

test('hourlyRate: utan timmar fragar motorn i stallet for att gissa', () => {
  assert.deepEqual(hourlyRate(40_000), { needs: 'timmar' });
  assert.deepEqual(hourlyRate(40_000, 0), { needs: 'timmar' });
});

// ---------------------------------------------------------------------------
// breakEven: forpackningssteget
// ---------------------------------------------------------------------------

test('breakEven: forpackning visar omrakningen som eget steg', () => {
  const r = breakEven(750, { value: 3, unit: 'låda' }, { value: 40, unit: 'st' }, 'st', {
    perPackage: 100,
  });
  assert.ok(!arBehov(r));
  if (arBehov(r)) return;

  assert.equal(r.steps.length, 3);
  assert.equal(r.steps[0]?.uttryck, '3 låda × 100 st');
  assert.equal(r.steps[0]?.resultat, '300 st');
  assert.equal(r.steps[1]?.uttryck, '300 st − 40 st');
  assert.equal(r.steps[1]?.resultat, '260 st');
  assert.equal(r.formatted, '2,89');
  assert.equal(r.exakt?.formatted, '2,88');
});

test('breakEven: utan forpackning ar det fortfarande tva steg', () => {
  const r = breakEven(12, { value: 1, unit: 'kg' }, { value: 300, unit: 'g' });
  assert.ok(!arBehov(r));
  if (arBehov(r)) return;
  assert.equal(r.steps.length, 2);
  assert.equal(r.steps[0]?.uttryck, '1 kg − 300 g');
});
