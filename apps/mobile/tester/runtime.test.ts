/**
 * runtimeVersion och de nya native-biblioteken (direktiv 41 steg 6).
 *
 * Testet låg först i `tester/uppdatering.test.ts`, men den filen läser det
 * privata repots utgivningsverktyg och kan därför inte följa med till det
 * publika repot (direktiv 41, TestFlight-omtaget). Det här är den delen som
 * BARA läser appens egna filer, och den ska köras i båda repona: det publika
 * repot är där TestFlight-bygget görs, och muren mellan native-modulerna och
 * gamla byggen ska gälla redan där.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const MOBIL = join(import.meta.dirname, '..');

test('runtimeVersion foljer appversionen, och den ar hojd for de nya biblioteken', () => {
  /*
    Direktiv 41 lade till react-native-keyboard-controller och expo-blur.
    Bada ar NATIVE-moduler: en uppdatering som anvander dem kraschar i ett
    bygge som inte har dem. runtimeVersion ar muren mellan dem, och med
    policyn `appVersion` ar muren appens version. Darfor 0.2.0 — hojd i
    samma andetag som biblioteken kom in.

    Testet ar kvar aven efter 0.2.0: det slar fel den dag nagon lagger till
    en native-modul utan att hoja versionen.
  */
  const app = JSON.parse(readFileSync(join(MOBIL, 'app.json'), 'utf8')) as {
    readonly expo: {
      readonly version: string;
      readonly runtimeVersion?: { readonly policy?: string } | string;
    };
  };
  assert.deepEqual(
    app.expo.runtimeVersion,
    { policy: 'appVersion' },
    'runtimeVersion ska folja appversionen',
  );
  const [stor, liten] = app.expo.version.split('.').map((d) => Number.parseInt(d, 10));
  assert.ok(
    (stor ?? 0) > 0 || (liten ?? 0) >= 2,
    `appversionen ar ${app.expo.version}; de nya native-biblioteken kraver minst 0.2.0`,
  );

  const paket = JSON.parse(readFileSync(join(MOBIL, 'package.json'), 'utf8')) as {
    readonly dependencies?: Record<string, string>;
  };
  for (const modul of ['react-native-keyboard-controller', 'expo-blur']) {
    assert.ok(paket.dependencies?.[modul], `${modul} saknas i beroendena`);
  }
});
