/**
 * Rörelsetokens, det levande talet och händelseströmmen (direktiv 39).
 *
 * `lib/rorelse.ts` importerar expo-haptics och reanimated och går inte att
 * ladda i ren Node, så tokenen läses ur källkoden. Det är inte sämre än det
 * ser ut: det som ska skyddas är just att VÄRDENA inte driver iväg från
 * rev-ux, och det står i filen.
 *
 * `lib/levande-tal.ts` och `lib/handelsestrom.ts` är rena och importeras.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { krympfaktor, talstorlek, tecken } from '../lib/levande-tal.ts';
import { senasteUtrakningar, visaAlla, visaStrom } from '../lib/handelsestrom.ts';

const ROT = join(import.meta.dirname, '..');

function las(...delar: string[]): string {
  return readFileSync(join(ROT, ...delar), 'utf8');
}

/** Kommentarerna beskriver besluten; testet ska läsa koden. */
function utanKommentarer(kallkod: string): string {
  return kallkod.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
}

// --------------------------------------------------------------- tokens

test('rm bar alla rev-ux-tokens med rev-ux varden', () => {
  const kod = utanKommentarer(las('lib', 'rorelse.ts'));
  const forvantat: readonly [string, string][] = [
    ['tap', '90'],
    ['swap', '160'],
    ['push', '320'],
    ['sheet', '380'],
    ['send', '420'],
    ['entrance', '550'],
    ['celebrate', '2500'],
    ['stagger', '35'],
    ['recedeScale', '0.94'],
    ['recedeDim', '0.45'],
    ['pressScale', '0.97'],
  ];
  for (const [namn, varde] of forvantat) {
    assert.match(
      kod,
      new RegExp(`${namn}:\\s*${varde.replace('.', '\\.')}\\b`, 'u'),
      `${namn} saknas eller har annat värde än rev-ux ${varde}`,
    );
  }
  for (const fjader of ['snappy', 'smooth', 'hero', 'bubble', 'bouncy']) {
    assert.match(kod, new RegExp(`${fjader}:\\s*\\{`, 'u'), `fjädern ${fjader} saknas`);
  }
});

test('fjadrarna har liten overstudsning: ingen overshootClamping', () => {
  const kod = utanKommentarer(las('lib', 'rorelse.ts'));
  assert.ok(
    !kod.includes('overshootClamping'),
    'overshootClamping är tillbaka — Fredriks beslut i direktiv 39 var överstudsning',
  );
});

test('reducerad rorelse ger alltid toning 160 ms', () => {
  const kod = utanKommentarer(las('lib', 'rorelse.ts'));
  assert.match(kod, /REDUCERAD_MS\s*=\s*160/u, 'reducerad rörelse är inte 160 ms');
});

test('haptiken ar central, sparrad och avstangbar', () => {
  const kod = utanKommentarer(las('lib', 'rorelse.ts'));
  assert.match(kod, /HAPTIKSPARR_MS\s*=\s*80/u, 'spärren är inte 80 ms');
  assert.ok(kod.includes('export function haptic('), 'det finns ingen central haptic()');
  assert.ok(kod.includes('export function sattHaptik('), 'av-knappen saknas');
  assert.match(kod, /if \(!haptikPa\) return;/u, 'haptic() lyder inte av-knappen');
  assert.match(kod, /nu - senaste < HAPTIKSPARR_MS/u, 'haptic() saknar spärren');

  /*
   * Haptiken ska gå EN väg ut. Andra filer får inte importera expo-haptics
   * själva — då gäller varken spärren eller av-knappen för dem.
   */
  for (const fil of [
    ['komponenter', 'ResultatSheet.tsx'],
    ['komponenter', 'Sheet.tsx'],
    ['app', '(tabs)', '_layout.tsx'],
    ['app', '(tabs)', 'index.tsx'],
  ]) {
    assert.ok(
      !las(...fil).includes("from 'expo-haptics'"),
      `${fil.join('/')} går runt den centrala haptiken`,
    );
  }
});

// ---------------------------------------------------------- levande tal

test('talet krymper nar det blir langt, i steg', () => {
  assert.equal(krympfaktor(1), 1);
  assert.equal(krympfaktor(6), 1);
  assert.equal(krympfaktor(7), 0.8);
  assert.equal(krympfaktor(9), 0.8);
  assert.equal(krympfaktor(10), 0.64);
  assert.equal(krympfaktor(12), 0.64);
  assert.equal(krympfaktor(13), 0.5);
  /* Krympningen går bara nedåt: talet växer aldrig ur kortet. */
  for (let n = 1; n < 40; n += 1) {
    assert.ok(krympfaktor(n) <= 1, `längden ${n} skalade upp talet`);
    assert.ok(krympfaktor(n) >= krympfaktor(n + 1), `trappan går uppåt vid ${n}`);
  }
});

test('talstorlek foljer grundstorleken ur temat', () => {
  assert.equal(talstorlek(60, '1 234'), 60);
  assert.equal(talstorlek(60, '1 234 567'), 48);
  assert.equal(talstorlek(60, '12 345 678'), 38);
});

test('tecken ger en nyckel per plats raknat fran hogern', () => {
  const ut = tecken('123');
  assert.deepEqual(
    ut.map((t) => t.nyckel),
    ['2-1', '1-2', '0-3'],
  );
  /*
   * 999 → 1 000: siffran på platsen längst till höger är fortfarande en
   * nolla på plats 0, så bara det som faktiskt ändrats rullar om.
   */
  const fore = tecken('999').map((t) => t.nyckel);
  const efter = tecken('1 000').map((t) => t.nyckel);
  assert.equal(efter.at(-1), '0-0');
  assert.notDeepEqual(fore, efter);
});

test('tecken skiljer siffror fran avgransare och komma', () => {
  const ut = tecken('1 234,50');
  assert.deepEqual(
    ut.map((t) => t.siffra),
    [true, false, true, true, true, false, true, true],
  );
  assert.equal(ut.map((t) => t.tecken).join(''), '1 234,50');
});

// -------------------------------------------------------- handelsestrom

test('strommen visar de tre senaste, nyast forst', () => {
  const historik = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(senasteUtrakningar(historik), ['a', 'b', 'c']);
  assert.deepEqual(senasteUtrakningar(historik, 1), ['a']);
  assert.deepEqual(senasteUtrakningar(historik, 0), []);
  /* Kortare historik än strömmen ger det som finns, inte tomma platser. */
  assert.deepEqual(senasteUtrakningar(['a']), ['a']);
});

test('tom historik ger inget block, och Visa alla bara nar det finns mer', () => {
  assert.equal(visaStrom([]), false);
  assert.equal(visaStrom(['a']), true);
  assert.equal(visaAlla(['a', 'b', 'c']), false);
  assert.equal(visaAlla(['a', 'b', 'c', 'd']), true);
});
