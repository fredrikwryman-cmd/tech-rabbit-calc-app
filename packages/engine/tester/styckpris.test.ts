/**
 * unitPrice: vad en annan mängd kostar (direktiv 35).
 *
 * "3 st för 25 kr, vad kostar 7?" är den vanligaste frågan i en affär, och
 * den gav "Det här kan jag inte räkna än" på både Android och iPhone.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { RaknefelError, unitPrice } from '../src/index.ts';

test('unitPrice: 3 st for 25 kr ger 58,33 kr for 7', () => {
  const r = unitPrice({ pris: 25, mangd: 3, enhet: 'st' }, { mangd: 7, enhet: 'st' });
  assert.ok(Math.abs(r.value - 58.3333333) < 0.0001);
  assert.equal(r.unit, 'kr');
  assert.equal(r.formatted, '58,33');
  // Priset per styck ska finnas kvar som en rad: det är talet man kan känna igen.
  assert.ok(Math.abs((r.rader?.[0]?.value ?? 0) - 25 / 3) < 0.0001);
  assert.equal(r.steps.length, 2);
});

test('unitPrice: enheterna far skilja sig - 250 g kostar 62 kr, ett kilo kostar 248', () => {
  const r = unitPrice({ pris: 62, mangd: 250, enhet: 'g' }, { mangd: 1, enhet: 'kg' });
  assert.ok(Math.abs(r.value - 248) < 0.0001, `fick ${r.value}`);
});

test('unitPrice: samma enhet som den kanda nar frageenheten ar tom', () => {
  const r = unitPrice({ pris: 45, mangd: 5, enhet: 'kg' }, { mangd: 2 });
  assert.ok(Math.abs(r.value - 18) < 0.0001, `fick ${r.value}`);
});

test('unitPrice: villkoret sager vad svaret vilar pa', () => {
  const r = unitPrice({ pris: 180, mangd: 12, enhet: 'st' }, { mangd: 5, enhet: 'st' });
  assert.ok(Math.abs(r.value - 75) < 0.0001);
  assert.ok((r.villkor ?? []).some((v) => v.includes('per')));
});

test('unitPrice: kantfall - noll mangd, negativt pris, olika dimensioner', () => {
  assert.throws(() => unitPrice({ pris: 25, mangd: 0 }, { mangd: 7 }), RaknefelError);
  assert.throws(() => unitPrice({ pris: -5, mangd: 3 }, { mangd: 7 }), RaknefelError);
  assert.throws(() => unitPrice({ pris: 25, mangd: 3 }, { mangd: 0 }), RaknefelError);
  assert.throws(
    () => unitPrice({ pris: 25, mangd: 3, enhet: 'kg' }, { mangd: 2, enhet: 'liter' }),
    RaknefelError,
  );
});
