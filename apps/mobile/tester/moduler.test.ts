/**
 * Vakttest: varje modul appen importerar måste vara ett DIREKT beroende.
 *
 * Direktiv 18. expo-modules-autolinking och React Natives egen autolinkning
 * tar bara med moduler som står i `dependencies` i apps/mobile/package.json.
 * En modul som bara finns i node_modules i roten (hoisting) fungerar i
 * utvecklarversionen men följer INTE med i bygget — och en uppdatering som
 * importerar den kastar vid start, varpå expo-updates faller tillbaka till
 * det inbyggda paketet och appen ser orörd ut.
 *
 * Testet läser källkoden, inte node_modules: det är importerna som avgör.
 */

import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROT = join(import.meta.dirname, '..');
const MAPPAR = ['app', 'komponenter', 'lib', 'design'];

/** Inbyggt i plattformen eller i React. Inget av det autolinkas. */
const EGNA = new Set(['react', 'react-native', 'react/jsx-runtime']);

function filer(mapp: string): string[] {
  const ut: string[] = [];
  for (const namn of readdirSync(mapp)) {
    const sokvag = join(mapp, namn);
    if (statSync(sokvag).isDirectory()) ut.push(...filer(sokvag));
    else if (namn.endsWith('.ts') || namn.endsWith('.tsx')) ut.push(sokvag);
  }
  return ut;
}

/** Paketnamnet ur en importsträng: '@scope/namn/djupt' → '@scope/namn'. */
function paketnamn(spec: string): string {
  const delar = spec.split('/');
  return spec.startsWith('@') ? delar.slice(0, 2).join('/') : (delar[0] ?? spec);
}

function importerade(): Map<string, string[]> {
  const karta = new Map<string, string[]>();
  for (const mapp of MAPPAR) {
    for (const fil of filer(join(ROT, mapp))) {
      const kallkod = readFileSync(fil, 'utf8');
      // Både statiska importer och det lazy require-mönstret appen använder.
      const traffar = kallkod.matchAll(/(?:from|require\()\s*'([^']+)'/g);
      for (const traff of traffar) {
        const spec = traff[1] ?? '';
        if (spec.startsWith('.') || spec.startsWith('node:')) continue;
        const namn = paketnamn(spec);
        if (EGNA.has(namn) || EGNA.has(spec)) continue;
        const var_ = karta.get(namn) ?? [];
        var_.push(fil.slice(ROT.length + 1));
        karta.set(namn, var_);
      }
    }
  }
  return karta;
}

const paket = JSON.parse(readFileSync(join(ROT, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
};

test('varje importerad modul ar ett direkt beroende i apps/mobile', () => {
  const saknas: string[] = [];
  for (const [namn, var_] of importerade()) {
    if (paket.dependencies[namn] === undefined) {
      saknas.push(`${namn} (importeras i ${var_.join(', ')})`);
    }
  }
  assert.deepEqual(saknas, [], `Moduler som inte ar direkta beroenden:\n${saknas.join('\n')}`);
});

test('de native-moduler som laddas lazy star kvar som beroenden', () => {
  // De laddas med require i try/catch, så TypeScript och Metro ser dem inte
  // som vanliga importer. Tas de bort ur package.json blir de tysta.
  for (const namn of [
    'expo-speech-recognition',
    'expo-sharing',
    'react-native-view-shot',
    'expo-system-ui',
    'expo-updates',
  ]) {
    assert.ok(paket.dependencies[namn] !== undefined, `${namn} saknas i dependencies`);
  }
});
