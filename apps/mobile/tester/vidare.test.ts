/** Testerna för Räkna vidare: hur frågan och ändringsmärket sätts ihop. */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { andringsmarke, byggVidareFraga, VIDARE_FORSLAG } from '../lib/vidare.ts';

test('fragan far ett punktslut innan andringen nar den saknas', () => {
  assert.equal(byggVidareFraga('100 kr delat pa 4', 'med moms'), '100 kr delat pa 4. med moms');
});

test('redan avslutad fraga far inget extra skiljetecken', () => {
  assert.equal(
    byggVidareFraga('Vad ska resten kosta styckvis?', 'och om tio blir osalda?'),
    'Vad ska resten kosta styckvis? och om tio blir osalda?',
  );
});

test('tom andring lamnar fragan oforandrad', () => {
  assert.equal(byggVidareFraga('  Vad kostar det?  ', '   '), 'Vad kostar det?');
});

test('tom ursprungsfraga ger bara andringen', () => {
  assert.equal(byggVidareFraga('', 'med moms'), 'med moms');
});

test('markets text kortas med ellips och far enkla blanksteg', () => {
  const langt = 'med 20 procent paslag och dessutom moms pa hela summan efter rabatten';
  const marke = andringsmarke(langt);
  assert.ok(marke.length <= 54, marke);
  assert.ok(marke.endsWith('…'));
  assert.equal(andringsmarke('  med   moms  '), 'med moms');
});

test('kort andring star kvar ord for ord', () => {
  assert.equal(andringsmarke('med moms'), 'med moms');
});

test('forslagen ar korta tillagg, inte hela fragor', () => {
  assert.equal(VIDARE_FORSLAG.length, 3);
  for (const f of VIDARE_FORSLAG) {
    assert.ok(f.length <= 24, f);
    assert.ok(!f.endsWith('?'), f);
  }
});
