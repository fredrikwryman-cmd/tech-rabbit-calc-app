/**
 * Testerna för de fyra vardagliga räknesätten (vyerna 30–33).
 *
 * Talen i vanliga-fall-testerna är designbildernas egna, så att motorn och
 * vyn kan jämföras rakt av.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  comparePrices,
  formatArbetstid,
  packages,
  RaknefelError,
  splitCost,
  TUSENAVSKILJARE,
  workTime,
} from '../src/index.ts';

// --------------------------------------------------------------- 30 jamforpris

test('comparePrices: 750 g for 49 kr mot 1,2 kg for 75 kr (vy 30)', () => {
  const r = comparePrices([
    { pris: 49, mangd: 750, enhet: 'g' },
    { pris: 75, mangd: 1.2, enhet: 'kg' },
  ]);
  assert.equal(r.unit, 'kr/kg');
  assert.equal(r.formatted, '62,50');
  assert.equal(r.betydelse, 'Billigast är B');
  assert.equal(r.rader?.length, 2);
  assert.equal(r.rader?.[0]?.formatted, '65,33');
  assert.equal(r.rader?.[1]?.formatted, '62,50');
  // Skillnaden: 65,33 − 62,50 = 2,83 kr/kg, alltsa 4,3 %.
  assert.match(r.villkor?.[0] ?? '', /2,83/u);
  assert.match(r.villkor?.[0] ?? '', /4,3 %/u);
});

test('comparePrices: tre varor, billigast vinner oavsett ordning', () => {
  const r = comparePrices([
    { pris: 30, mangd: 1, enhet: 'kg' },
    { pris: 10, mangd: 1, enhet: 'kg' },
    { pris: 20, mangd: 1, enhet: 'kg' },
  ]);
  assert.equal(r.value, 10);
  assert.equal(r.betydelse, 'Billigast är B');
});

test('comparePrices: egna namn anvands i stallet for bokstaver', () => {
  const r = comparePrices([
    { pris: 20, mangd: 1, enhet: 'l', namn: 'Stora' },
    { pris: 12, mangd: 0.5, enhet: 'l', namn: 'Lilla' },
  ]);
  assert.equal(r.betydelse, 'Billigast är Stora');
});

test('comparePrices: kantfall - en vara, noll mangd, negativt pris, olika mattslag', () => {
  assert.throws(() => comparePrices([{ pris: 10, mangd: 1, enhet: 'kg' }]), RaknefelError);
  assert.throws(
    () =>
      comparePrices([
        { pris: 10, mangd: 0, enhet: 'kg' },
        { pris: 20, mangd: 1, enhet: 'kg' },
      ]),
    RaknefelError,
  );
  assert.throws(
    () =>
      comparePrices([
        { pris: -10, mangd: 1, enhet: 'kg' },
        { pris: 20, mangd: 1, enhet: 'kg' },
      ]),
    RaknefelError,
  );
  assert.throws(
    () =>
      comparePrices([
        { pris: 10, mangd: 1, enhet: 'kg' },
        { pris: 20, mangd: 1, enhet: 'l' },
      ]),
    RaknefelError,
  );
});

test('comparePrices: gratis vara ar billigast och fyller ingen division med noll', () => {
  const r = comparePrices([
    { pris: 0, mangd: 1, enhet: 'st' },
    { pris: 20, mangd: 1, enhet: 'st' },
  ]);
  assert.equal(r.value, 0);
});

// ------------------------------------------------------------ 31 dela kostnader

test('splitCost: 900, 300 och 0 kr delat pa tre (vy 31)', () => {
  const r = splitCost([{ betalat: 900 }, { betalat: 300 }, { betalat: 0 }]);
  assert.equal(r.value, 400);
  assert.equal(r.formatted, '400,00');
  assert.equal(r.betydelse, 'Så går det jämnt ut');
  const overforingar = (r.rader ?? []).filter((rad) => rad.etikett.includes('betalar'));
  assert.equal(overforingar.length, 2);
  assert.equal(overforingar[0]?.etikett, 'C betalar A');
  assert.equal(overforingar[0]?.value, 400);
  assert.equal(overforingar[1]?.etikett, 'B betalar A');
  assert.equal(overforingar[1]?.value, 100);
  assert.match(r.villkor?.[1] ?? '', /2 överföringar/u);
});

test('splitCost: bara en totalsumma och ett antal personer', () => {
  const r = splitCost([], 4, { total: 1000 });
  assert.equal(r.value, 250);
  assert.equal(r.betydelse, 'Var och en betalar');
  assert.equal((r.rader ?? []).filter((rad) => rad.etikett.includes('betalar')).length, 0);
});

test('splitCost: redan jamnt ger inga overforingar', () => {
  const r = splitCost([{ betalat: 500 }, { betalat: 500 }]);
  assert.equal(r.value, 500);
  assert.equal((r.rader ?? []).filter((rad) => rad.etikett.includes('betalar')).length, 0);
});

test('splitCost: kantfall - noll personer, negativt utlagg, noll total', () => {
  assert.throws(() => splitCost([], 0, { total: 100 }), RaknefelError);
  assert.throws(() => splitCost([{ betalat: -100 }, { betalat: 0 }]), RaknefelError);
  assert.throws(() => splitCost([], 3, { total: 0 }), RaknefelError);
});

test('splitCost: tre som delar 100 kr ger ore som gar jamnt ut', () => {
  const r = splitCost([], 3, { total: 100 });
  assert.ok(Math.abs(r.value - 33.3333333) < 1e-5);
  assert.equal(r.formatted, '33,33');
});

// ------------------------------------------------------ 32 forpackningar och svinn

test('packages: golv 23 m2, 10 % spill, paket om 2,2 m2 (vy 32)', () => {
  const r = packages(23, 2.2, 'm²', { svinn: 10, forpackningsnamn: 'paket' });
  assert.equal(r.value, 12);
  assert.equal(r.formatted, '12');
  assert.equal(r.unit, 'paket');
  assert.equal(r.betydelse, 'Antal paket att köpa');
  // 25,3 m2 behovs, 25,3 / 2,2 = 11,5 → 12 paket.
  assert.equal(r.exakt?.formatted, '11,50');
  assert.match(r.villkor?.[0] ?? '', /25,3\s?m²/u);
  const over = (r.rader ?? []).find((rad) => rad.etikett === 'Överskott');
  assert.equal(over?.formatted, '1,1');
});

test('packages: utan svinn, och jamnt upp', () => {
  const r = packages(10, 2, 'st');
  assert.equal(r.value, 5);
  assert.equal(r.exakt?.value, 5);
  assert.equal((r.rader ?? []).some((rad) => rad.etikett.startsWith('Svinn')), false);
});

test('packages: kantfall - noll behov, negativt svinn, svinn 100 %, noll forpackning', () => {
  assert.throws(() => packages(0, 2, 'st'), RaknefelError);
  assert.throws(() => packages(10, 0, 'st'), RaknefelError);
  assert.throws(() => packages(10, 2, 'st', { svinn: -5 }), RaknefelError);
  assert.throws(() => packages(10, 2, 'st', { svinn: 100 }), RaknefelError);
});

// ---------------------------------------------------------------- 33 arbetstid

test('workTime: 07:30 till 16:15 med 30 min rast (vy 33)', () => {
  const r = workTime([{ start: '07:30', slut: '16:15', rast: 30 }]);
  assert.equal(r.formatted, '8 h 15 min');
  // Enheten star redan i formatted: "8 h 15 min h" vore fel.
  assert.equal(r.unit, '');
  assert.equal(r.value, 8.25);
  assert.match(r.villkor?.[0] ?? '', /30 minuter rast/u);
});

test('workTime: over midnatt raknas som nasta dygn', () => {
  const r = workTime([{ start: '22:00', slut: '00:30' }]);
  assert.equal(r.formatted, '2 h 30 min');
  assert.equal(r.value, 2.5);
  assert.ok((r.villkor ?? []).includes('Passet går över midnatt'));
});

test('workTime: flera dagar summeras och far en rad var', () => {
  const r = workTime([
    { start: '08:00', slut: '12:00' },
    { start: '13:00', slut: '17:30' },
  ]);
  assert.equal(r.formatted, '8 h 30 min');
  assert.equal(r.rader?.length, 2);
  assert.equal(r.betydelse, 'Arbetad tid, alla dagar');
});

test('workTime: med timlon blir lonen svaret och tiden villkoret', () => {
  const r = workTime([{ start: '08:00', slut: '16:00', rast: 30 }], { timlon: 200 });
  assert.equal(r.unit, 'kr');
  assert.equal(r.formatted, `1${TUSENAVSKILJARE}500,00`);
  assert.match(r.villkor?.[0] ?? '', /7 h 30 min/u);
});

test('workTime: kantfall - inga dagar, trasigt klockslag, rast langre an passet', () => {
  assert.throws(() => workTime([]), RaknefelError);
  assert.throws(() => workTime([{ start: 'sju', slut: '16:00' }]), RaknefelError);
  assert.throws(() => workTime([{ start: '25:00', slut: '26:00' }]), RaknefelError);
  assert.throws(() => workTime([{ start: '08:00', slut: '09:00', rast: 60 }]), RaknefelError);
});

test('formatArbetstid: timmar, minuter och bara minuter', () => {
  assert.equal(formatArbetstid(495), '8 h 15 min');
  assert.equal(formatArbetstid(120), '2 h');
  assert.equal(formatArbetstid(45), '45 min');
});

test('workTime: huvudsvaret foljer fragan nar timlonen finns (direktiv 24)', () => {
  const lon = workTime([{ start: '08:00', slut: '16:00', rast: 30 }], {
    timlon: 200,
    huvudsvar: 'lon',
  });
  assert.equal(lon.unit, 'kr');
  assert.equal(lon.formatted, `1${TUSENAVSKILJARE}500,00`);
  assert.match(lon.villkor?.[0] ?? '', /7 h 30 min/u);

  const tid = workTime([{ start: '08:00', slut: '16:00', rast: 30 }], {
    timlon: 200,
    huvudsvar: 'tid',
  });
  assert.equal(tid.unit, '');
  assert.equal(tid.formatted, '7 h 30 min');
  assert.equal(tid.betydelse, 'Arbetad tid');
  // Lonen finns kvar, som villkor och som faktum.
  assert.match(tid.villkor?.[0] ?? '', /Lön 1/u);
  assert.ok((tid.fakta ?? []).some((f) => f.nyckel === 'lon'));
});
