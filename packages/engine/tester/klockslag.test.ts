/**
 * Testerna för klockslag ± tid (direktiv 30).
 *
 * Buggen som gav räknesättet: "måste vara framme senast 15:15, när behöver
 * jag åka?" hade inget räknesätt alls, och Räkna svarade "det här kan jag
 * inte räkna än".
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { formatKlockslag, RaknefelError, timeShift } from '../src/index.ts';

test('formatKlockslag: nollor fylls ut och dygnet rullar runt', () => {
  assert.equal(formatKlockslag(0), '00:00');
  assert.equal(formatKlockslag(9 * 60 + 5), '09:05');
  assert.equal(formatKlockslag(1439), '23:59');
  assert.equal(formatKlockslag(1440), '00:00');
  assert.equal(formatKlockslag(-30), '23:30');
});

test('ankomst minus restid: framme 15:15, resan tar 1 h 50 min', () => {
  const r = timeShift('15:15', { timmar: 1, minuter: 50 });
  assert.equal(r.formatted, '13:25');
  assert.equal(r.unit, '');
  assert.equal(r.betydelse, 'Senast dags att åka');
  assert.equal(r.villkor?.[0], 'Framme senast 15:15, restid 1 h 50 min');
  const avresa = r.fakta?.find((f) => f.nyckel === 'avresa');
  assert.equal(avresa?.formatted, '13:25');
  const ankomst = r.fakta?.find((f) => f.nyckel === 'ankomst');
  assert.equal(ankomst?.formatted, '15:15');
});

test('avresa plus restid: åker 08:00, resan tar 2 h 30 min', () => {
  const r = timeShift('08:00', { timmar: 2, minuter: 30, riktning: 'ankomst' });
  assert.equal(r.formatted, '10:30');
  assert.equal(r.betydelse, 'Framme');
  assert.equal(r.fakta?.find((f) => f.nyckel === 'ankomst')?.formatted, '10:30');
});

test('marginalen läggs till restiden, i båda riktningarna', () => {
  const bakat = timeShift('15:15', { timmar: 1, minuter: 50, marginal: 15 });
  assert.equal(bakat.formatted, '13:10');
  assert.ok(bakat.villkor?.includes('15 minuters marginal är inräknad'));
  const framat = timeShift('08:00', { timmar: 1, marginal: 20, riktning: 'ankomst' });
  // Marginalen ska göra svaret säkrare, inte tightare: 08:00 + 1 h + 20 min.
  assert.equal(framat.formatted, '09:20');
});

test('bara minuter, och bara timmar, går lika bra', () => {
  assert.equal(timeShift('10:00', { minuter: 45 }).formatted, '09:15');
  assert.equal(timeShift('10:00', { timmar: 3 }).formatted, '07:00');
});

test('över midnatt bakåt: framme 00:30 efter 2 h resa är 22:30 dagen före', () => {
  const r = timeShift('00:30', { timmar: 2 });
  assert.equal(r.formatted, '22:30');
  assert.ok(r.villkor?.includes('Tiden ligger dagen före'));
});

test('över midnatt framåt: avresa 23:00 plus 2 h 30 min är 01:30 dygnet efter', () => {
  const r = timeShift('23:00', { timmar: 2, minuter: 30, riktning: 'ankomst' });
  assert.equal(r.formatted, '01:30');
  assert.ok(r.villkor?.includes('Tiden ligger dygnet efter'));
});

test('ett helt dygn eller mer rullar runt och säger vilket dygn', () => {
  const r = timeShift('12:00', { timmar: 26 });
  assert.equal(r.formatted, '10:00');
  assert.ok(r.villkor?.includes('Tiden ligger dagen före'));
});

test('midnatt exakt: 07:00 minus 7 h är 00:00 samma dygn', () => {
  const r = timeShift('07:00', { timmar: 7 });
  assert.equal(r.formatted, '00:00');
  assert.equal(r.villkor?.includes('Tiden ligger dagen före'), false);
});

test('punkt som avskiljare i klockslaget läses också', () => {
  assert.equal(timeShift('15.15', { timmar: 1, minuter: 50 }).formatted, '13:25');
});

test('utan restid räknar motorn inte', () => {
  assert.throws(() => timeShift('15:15', {}), RaknefelError);
  assert.throws(() => timeShift('15:15', { timmar: 0, minuter: 0 }), RaknefelError);
});

test('ett klockslag som inte finns avvisas', () => {
  assert.throws(() => timeShift('25:00', { timmar: 1 }), RaknefelError);
  assert.throws(() => timeShift('i morgon', { timmar: 1 }), RaknefelError);
});

test('stegen bär klockslagen, så förklaringen får använda dem', () => {
  const r = timeShift('15:15', { timmar: 1, minuter: 50, marginal: 15 });
  const text = r.steps.map((s) => `${s.uttryck} ${s.resultat}`).join(' ');
  assert.ok(text.includes('15:15'));
  assert.ok(text.includes('13:10'));
  assert.ok(text.includes('2 h 5 min'));
});

test('decimaltimmar: 2,5 timmar är 2 h 30 min', () => {
  const r = timeShift('08:00', { timmar: 2.5, riktning: 'ankomst' });
  assert.equal(r.formatted, '10:30');
  assert.equal(r.villkor?.[0], 'Avresa 08:00, restid 2 h 30 min');
});
