/**
 * F01 avrundning som uppfyller målet, och F13 etiketter och villkor.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  arBehov,
  breakEven,
  markup,
  praktisktVarde,
  priceFromMargin,
  stegdecimaler,
  tackerMalet,
  valutasteg,
} from '../src/index.ts';

const NB = ' ';

/** 750 kr, 300 st, 40 till eget bruk. */
function skruvar() {
  const r = breakEven(750, { value: 300, unit: 'st' }, { value: 40, unit: 'st' }, 'st');
  assert.ok(!arBehov(r));
  if (arBehov(r)) throw new Error('oväntat behov');
  return r;
}

test('F01: 2,88 täcker inte inköpet, 2,89 gör det', () => {
  assert.equal(tackerMalet(2.88, 260, 750), false);
  assert.equal(tackerMalet(2.89, 260, 750), true);
});

test('F01: svaret ar 2,89 och 2,88 star kvar som det exakta talet', () => {
  // Malet ar att tacka inkopet, sa det avrundade talet ar svaret. "Minst
  // 2,88" vore fel rad: 2,88 x 260 = 748,80 och tacker inte 750.
  const r = skruvar();
  assert.equal(r.formatted, '2,89');
  assert.ok(Math.abs(r.value - 2.89) < 1e-9);
  assert.equal(r.exakt?.formatted, '2,88');
  assert.equal(r.exakt?.unit, 'kr/st');
  // Bada falten finns aldrig samtidigt.
  assert.equal(r.praktiskt, undefined);
});

test('F01: skälet säger vad som annars saknas', () => {
  const r = skruvar();
  // 2,88 x 260 = 748,80, alltsa 1,20 kr for lite.
  assert.match(r.exakt?.skal ?? '', /748,80/u);
  assert.match(r.exakt?.skal ?? '', /täcker inte/u);
});

test('F01: hela restpartiet kostar 750 kr', () => {
  const r = breakEven(750, { value: 300, unit: 'st' }, { value: 40, unit: 'st' }, 'st', {
    forpackningar: [260],
  });
  assert.ok(!arBehov(r));
  if (arBehov(r)) return;
  assert.equal(r.rader?.[0]?.formatted, '750,00');
  assert.equal(r.rader?.[0]?.etikett, `260${NB}st`);
});

test('F01: 80 kr med 30 % marginal ger 114,29', () => {
  assert.equal(priceFromMargin(80, 30).formatted, '114,29');
});

test('F01: 80 kr med 30 % påslag ger 104', () => {
  assert.equal(markup(80, 30).formatted, '104,00');
});

test('F01: påslag och marginal är inte samma tal', () => {
  const p = markup(80, 30);
  const m = priceFromMargin(80, 30);
  assert.notEqual(p.value, m.value);
  // Paslaget 30 % ger marginalen 23,1 %, inte 30 %.
  assert.equal(p.fakta?.find((f) => f.nyckel === 'marginal')?.formatted, '23,1');
  // Marginalen 30 % kraver paslaget 42,9 %.
  assert.equal(m.fakta?.find((f) => f.nyckel === 'paslag')?.formatted, '42,9');
});

test('F01: högsta kostnad rundas nedåt', () => {
  const p = praktisktVarde(2.889, 'hogsta-kostnad', { unit: 'kr' });
  assert.equal(p?.value, 2.88);
  assert.match(p?.skal ?? '', /nedåt/u);
});

test('F01: antal förpackningar rundas uppåt till heltal', () => {
  const p = praktisktVarde(3.2, 'antal-forpackningar', { unit: 'st' });
  assert.equal(p?.value, 4);
  assert.equal(p?.formatted, '4');
});

test('F01: ingen rad när avrundningen inte ändrar något', () => {
  assert.equal(praktisktVarde(10, 'minsta-pris', { unit: 'kr' }), null);
  assert.equal(praktisktVarde(2.5, 'ingen', { unit: 'kr' }), null);
});

test('F01: valutasteg antar inte två decimaler universellt', () => {
  assert.equal(valutasteg('kr'), 0.01);
  assert.equal(valutasteg('JPY'), 1);
  assert.equal(stegdecimaler(0.01), 2);
  assert.equal(stegdecimaler(1), 0);
});

test('F01: yen avrundas till hela enheter', () => {
  const p = praktisktVarde(1234.2, 'minsta-pris', { unit: 'JPY', valuta: 'JPY' });
  assert.equal(p?.value, 1235);
});

// --------------------------------------------------------------- F13

test('F13: resultatet har en betydelse och synliga villkor', () => {
  const r = skruvar();
  assert.equal(r.betydelse, 'Minsta pris per st');
  assert.deepEqual(r.villkor, [`Om alla 260${NB}st säljs`, 'efter inköpskostnaden']);
});

test('F13: marginalen kallas aldrig vinst när bara inköpet är med', () => {
  const r = priceFromMargin(80, 30);
  assert.deepEqual(r.villkor, ['30 % marginal', 'bara inköpet är medräknat']);
  const text = JSON.stringify(r);
  assert.ok(!/nettovinst/iu.test(text), 'får aldrig kallas nettovinst');
});

test('F13: timpris är inte nettolön', () => {
  // Importeras lokalt for att halla testlistan kort.
  // eslint-disable-next-line
  return import('../src/index.ts').then(({ hourlyRate, arBehov: arB }) => {
    const r = hourlyRate(40_000, 160);
    assert.ok(!arB(r));
    if (arB(r)) return;
    assert.equal(r.betydelse, 'Timpris');
    assert.ok(r.villkor?.includes('räknat på debiterbara timmar'));
    assert.ok(!/nettolön/iu.test(JSON.stringify(r)));
  });
});

test('F13: varje räknesätt lämnar en betydelse', () => {
  const r = skruvar();
  assert.ok(r.betydelse.length > 0);
  assert.ok(markup(80, 30).betydelse.length > 0);
  assert.ok(priceFromMargin(80, 30).betydelse.length > 0);
});
