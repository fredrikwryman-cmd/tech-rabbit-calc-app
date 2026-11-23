import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  arBehov,
  type Behov,
  breakEven as breakEvenRa,
  convert as convertRa,
  formatTal,
  HUVUDENHET,
  interest,
  margin,
  RaknefelError,
  type Resultat,
  TUSENAVSKILJARE,
} from '../src/index.ts';

const MELLANSLAG = TUSENAVSKILJARE;

/** Plockar ut resultatet. Fäller testet om motorn svarade med ett behov. */
function res(svar: Resultat | Behov): Resultat {
  assert.ok(!arBehov(svar), 'Motorn svarade { needs: ... } i stället för ett resultat.');
  return svar;
}

/** De flesta testerna räknar utan förpackningar och vill ha ett resultat. */
const convert: (...a: Parameters<typeof convertRa>) => Resultat = (...a) => res(convertRa(...a));
const breakEven: (...a: Parameters<typeof breakEvenRa>) => Resultat = (...a) =>
  res(breakEvenRa(...a));

// ---------------------------------------------------------------------------
// Kraven i direktivet
// ---------------------------------------------------------------------------

test('krav: 12 kr, 1 kg, 300 g anvant ger 17,14 kr/kg', () => {
  const r = breakEven(12, { value: 1, unit: 'kg' }, { value: 300, unit: 'g' });
  // 17,142857 rundas upp till 17,15 for att tacka de 12 kronorna.
  assert.equal(r.formatted, '17,15');
  assert.equal(r.exakt?.formatted, '17,14');
  assert.equal(r.unit, 'kr/kg');
  assert.ok(Math.abs((r.exakt?.value ?? 0) - 12 / 0.7) < 1e-12);
  assert.equal(r.steps.length, 2);
  assert.equal(r.steps[0]?.resultat, `0,7${MELLANSLAG}kg`);
});

test('krav: kop 40, salj 65 ger 38,5 %', () => {
  const r = margin(40, 65);
  assert.equal(r.formatted, '38,5');
  assert.equal(r.unit, '%');
  assert.ok(Math.abs(r.value - (25 / 65) * 100) < 1e-12);
});

test('krav: 3,5 % pa 200 000 kr i ett ar ger 7 000 kr', () => {
  const r = interest(200_000, 3.5);
  assert.equal(r.value, 7000);
  assert.equal(r.unit, 'kr');
  assert.equal(r.formatted, `7${MELLANSLAG}000`);
});

// ---------------------------------------------------------------------------
// Formatering
// ---------------------------------------------------------------------------

test('formatTal skriver svensk stil', () => {
  assert.equal(formatTal(1234567.891), `1${MELLANSLAG}234${MELLANSLAG}567,89`);
  assert.equal(formatTal(7000), `7${MELLANSLAG}000`);
  assert.equal(formatTal(0.5), '0,5');
  assert.equal(formatTal(-1500.5), `-1${MELLANSLAG}500,5`);
  assert.equal(formatTal(17.142857, 2), '17,14');
  assert.equal(formatTal(38.4615, 1), '38,5');
  assert.equal(formatTal(5, 2), '5,00');
  assert.equal(formatTal(100, 0), '100');
  assert.equal(formatTal(-0.001, 2), '0,00');
  assert.equal(formatTal(Number.NaN), '–');
  assert.equal(formatTal(Number.POSITIVE_INFINITY), '–');
});

// ---------------------------------------------------------------------------
// convert
// ---------------------------------------------------------------------------

test('convert: vikt', () => {
  assert.equal(convert(1, 'kg', 'g').value, 1000);
  assert.equal(convert(2500, 'mg', 'g').value, 2.5);
  assert.equal(convert(1, 'ton', 'kg').value, 1000);
  assert.equal(convert(5, 'hg', 'kg').value, 0.5);
});

test('convert: volym', () => {
  assert.equal(convert(1, 'l', 'ml').value, 1000);
  assert.equal(convert(1, 'm³', 'l').value, 1000);
  assert.equal(convert(33, 'cl', 'dl').value, 3.3);
});

test('convert: langd', () => {
  assert.equal(convert(1, 'km', 'm').value, 1000);
  assert.equal(convert(250, 'cm', 'm').value, 2.5);
  assert.equal(convert(12, 'mm', 'cm').value, 1.2);
});

test('convert: yta', () => {
  assert.equal(convert(1, 'hektar', 'm²').value, 10_000);
  assert.equal(convert(10_000, 'cm²', 'm²').value, 1);
  assert.equal(convert(2.5, 'hektar', 'm²').value, 25_000);
});

test('convert: tid, sekund till ar', () => {
  assert.equal(convert(1, 'h', 'min').value, 60);
  assert.equal(convert(1, 'dygn', 'h').value, 24);
  assert.equal(convert(1, 'vecka', 'dygn').value, 7);
  assert.equal(convert(1, 'år', 'dygn').value, 365);
  assert.equal(convert(1, 'månad', 'dygn').value, 30);
  assert.equal(convert(31_536_000, 's', 'år').value, 1);
});

test('convert: forpackning utan perPackage ger behov, aldrig en gissning', () => {
  assert.deepEqual(convertRa(1, 'pall', 'st'), { needs: 'perPackage' });
  assert.deepEqual(convertRa(1, 'låda', 'pkt'), { needs: 'perPackage' });
  assert.deepEqual(convertRa(12, 'st', 'pkt'), { needs: 'perPackage' });
});

test('convert: forpackning med perPackage som tal', () => {
  assert.equal(convert(1, 'låda', 'st', { perPackage: 24 }).value, 24);
  assert.equal(convert(480, 'st', 'pall', { perPackage: 480 }).value, 1);
});

test('convert: forpackning med perPackage som tabell', () => {
  assert.equal(convert(1, 'pall', 'låda', { perPackage: { pall: 480, låda: 24 } }).value, 20);
  // Ett tal racker inte nar tva olika forpackningsenheter ar med.
  assert.deepEqual(convertRa(1, 'pall', 'låda', { perPackage: 480 }), { needs: 'perPackage' });
  // En ofullstandig tabell ar inte heller nog.
  assert.deepEqual(convertRa(1, 'pall', 'låda', { perPackage: { pall: 480 } }), {
    needs: 'perPackage',
  });
});

test('convert: st ar oforandrat, det ar bara forpackningarna som saknar matt', () => {
  assert.equal(convert(7, 'st', 'st').value, 7);
});

test('breakEven: forpackning utan perPackage ger behov', () => {
  assert.deepEqual(breakEvenRa(500, { value: 10, unit: 'låda' }, { value: 2, unit: 'låda' }), {
    needs: 'perPackage',
  });
  const r = breakEven(500, { value: 10, unit: 'låda' }, { value: 2, unit: 'låda' }, 'st', {
    perPackage: 24,
  });
  // 8 lador kvar = 192 st, 500 kr / 192 st
  assert.ok(Math.abs((r.exakt?.value ?? r.value) - 500 / 192) < 1e-12);
  assert.equal(r.unit, 'kr/st');
});

test('convert: skrivsatt och alias', () => {
  assert.equal(convert(1, 'kilo', 'gram').value, 1000);
  assert.equal(convert(1, 'm2', 'cm2').value, 10_000);
  assert.equal(convert(1, 'KG', ' g ').value, 1000);
  assert.equal(convert(1, 'ha', 'kvm').value, 10_000);
});

test('convert: samma enhet ger samma tal', () => {
  const r = convert(7, 'kg', 'kg');
  assert.equal(r.value, 7);
  assert.equal(r.steps.length, 1);
});

test('convert: fel enhet och fel dimension', () => {
  assert.throws(
    () => convert(1, 'kg', 'liter'),
    (e: unknown) => e instanceof RaknefelError && e.kod === 'olika-dimensioner',
  );
  assert.throws(
    () => convert(1, 'famn', 'm'),
    (e: unknown) => e instanceof RaknefelError && e.kod === 'okand-enhet',
  );
});

// ---------------------------------------------------------------------------
// breakEven
// ---------------------------------------------------------------------------

test('breakEven: svarar i huvudenheten nar inget annat begars', () => {
  for (const [dimension, huvud] of Object.entries(HUVUDENHET)) {
    if (dimension === 'tid' || dimension === 'antal') continue;
    const r = breakEven(100, { value: 10, unit: huvud }, { value: 0, unit: huvud });
    assert.equal(r.unit, `kr/${huvud}`);
  }
});

test('breakEven: begard utenhet', () => {
  const r = breakEven(12, { value: 1, unit: 'kg' }, { value: 300, unit: 'g' }, 'hg');
  assert.equal(r.unit, 'kr/hg');
  assert.ok(Math.abs((r.exakt?.value ?? r.value) - 12 / 7) < 1e-12);
});

test('breakEven: tal utan enhet lases i unit', () => {
  const r = breakEven(500, 100, 20, 'st');
  assert.equal(r.unit, 'kr/st');
  assert.equal(r.value, 500 / 80);
});

test('breakEven: egen valuta', () => {
  const r = breakEven(12, { value: 1, unit: 'kg' }, { value: 0, unit: 'g' }, undefined, {
    valuta: 'EUR',
  });
  assert.equal(r.unit, 'EUR/kg');
});

test('breakEven: allt forbrukat och mer an allt forbrukat', () => {
  assert.throws(
    () => breakEven(12, { value: 1, unit: 'kg' }, { value: 1, unit: 'kg' }),
    (e: unknown) => e instanceof RaknefelError && e.kod === 'division-med-noll',
  );
  assert.throws(
    () => breakEven(12, { value: 1, unit: 'kg' }, { value: 2, unit: 'kg' }),
    (e: unknown) => e instanceof RaknefelError && e.kod === 'negativ-kvarvarande',
  );
});

test('breakEven: stegen beskriver rakningen', () => {
  const r = breakEven(12, { value: 1, unit: 'kg' }, { value: 300, unit: 'g' });
  assert.deepEqual(
    r.steps.map((s) => s.nr),
    [1, 2],
  );
  assert.equal(r.steps[0]?.etikett, 'Kvar att sälja');
  assert.equal(r.steps[0]?.uttryck, `1${MELLANSLAG}kg − 300${MELLANSLAG}g`);
  assert.equal(r.steps[1]?.resultat, `17,14${MELLANSLAG}kr/kg`);
});

// ---------------------------------------------------------------------------
// margin
// ---------------------------------------------------------------------------

test('margin: vanliga fall', () => {
  assert.equal(margin(50, 100).value, 50);
  assert.equal(margin(0, 100).value, 100);
  assert.equal(margin(100, 50).value, -100);
  assert.equal(margin(100, 50).formatted, '-100,0');
});

test('margin: forsaljningspris noll', () => {
  assert.throws(
    () => margin(40, 0),
    (e: unknown) => e instanceof RaknefelError && e.kod === 'division-med-noll',
  );
});

// ---------------------------------------------------------------------------
// interest
// ---------------------------------------------------------------------------

test('interest: enkel ranta over flera ar', () => {
  const r = interest(200_000, 3.5, 3);
  assert.equal(r.value, 21_000);
  assert.equal(r.formatted, `21${MELLANSLAG}000`);
  assert.equal(r.steps.length, 2);
});

test('interest: ett ar ger ett steg', () => {
  assert.equal(interest(200_000, 3.5).steps.length, 1);
});

test('interest: noll ranta och halvar', () => {
  assert.equal(interest(1000, 0).value, 0);
  assert.equal(interest(10_000, 5, 0.5).value, 250);
});

test('interest: ogiltiga tal', () => {
  assert.throws(
    () => interest(Number.NaN, 3.5),
    (e: unknown) => e instanceof RaknefelError && e.kod === 'ogiltigt-tal',
  );
});
