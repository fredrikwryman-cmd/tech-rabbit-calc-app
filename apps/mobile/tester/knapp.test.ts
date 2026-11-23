/**
 * Knappens gröna yta: måtten, inte utseendet.
 *
 * Direktiv 27: gradienten ritades med procentmått i en Svg utan viewBox och
 * täckte ungefär 88 % av knappen, förskjuten. Rättningen är att måtten
 * kommer från onLayout och sätts i punkter. Det går inte att rendera här,
 * men det GÅR att läsa koden och kräva att lagret aldrig ritas i procent
 * igen — det var just den konstruktionen som var felet.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROT = join(import.meta.dirname, '..');

function las(...delar: string[]): string {
  return readFileSync(join(ROT, ...delar), 'utf8');
}

/**
 * Koden utan kommentarer.
 *
 * Kommentarerna BESKRIVER felet som rättades ("ritades förut med
 * width=100%"), och ett test som läser dem skulle fälla på sin egen
 * förklaring.
 */
function utanKommentarer(kallkod: string): string {
  return kallkod.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
}

test('knappens grona lager ritas i punkter, aldrig i procent', () => {
  const kallkod = utanKommentarer(las('komponenter', 'Knapp.tsx'));
  assert.ok(!kallkod.includes('width="100%"'), 'gradienten ritas i procent igen');
  assert.ok(kallkod.includes('onLayout={matUpp}'), 'knappen mäts inte längre');
  assert.ok(
    kallkod.includes('gradientUnits="userSpaceOnUse"'),
    'gradienten saknar userSpaceOnUse och faller tillbaka på andelar',
  );
  // Rect ska få knappens uppmätta mått, inte en konstant.
  assert.ok(kallkod.includes('width={matt.bredd}'), 'rektangeln följer inte bredden');
  assert.ok(kallkod.includes('height={matt.hojd}'), 'rektangeln följer inte höjden');
  assert.ok(kallkod.includes('rx={matt.hojd / 2}'), 'radien följer inte höjden');
});

test('mikrofonknappens yta ritas ocksa i punkter', () => {
  const kallkod = utanKommentarer(las('komponenter', 'Rost.tsx'));
  assert.ok(!kallkod.includes('width="100%"'), 'mikrofonens yta ritas i procent');
  assert.ok(kallkod.includes('gradientUnits="userSpaceOnUse"'));
});

test('huvudsvaret anvander greenAnswer, inte greenText', () => {
  for (const fil of [
    ['komponenter', 'ResultatSheet.tsx'],
    ['komponenter', 'Resultatvyer.tsx'],
    ['komponenter', 'Historikrad.tsx'],
    ['komponenter', 'Delning.tsx'],
  ]) {
    assert.ok(
      las(...fil).includes("greenAnswer"),
      `${fil.join('/')} målar inte huvudsvaret med greenAnswer`,
    );
  }
});

test('greenAnswer ar klargront i bada temana', () => {
  const tokens = JSON.parse(
    readFileSync(join(ROT, '..', '..', 'design', 'tokens', 'tokens.json'), 'utf8'),
  ) as { color: Record<string, { light: string; dark: string }> };
  assert.deepEqual(tokens.color['greenAnswer'], { light: '#1CF038', dark: '#1CF038' });
});
