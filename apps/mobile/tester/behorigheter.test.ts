/**
 * Behörighetstexter och behörigheter (direktiv 34).
 *
 * Apple underkände bygge 5 och 6 med ITMS-90683: NSPhotoLibraryUsageDescription
 * saknades i Info.plist. Orsaken är att `expo-file-system` — som följer med
 * `expo` självt — länkar PhotoKit (`PHPhotoLibrary.authorizationStatus`), och
 * Apple läser binären, inte vad appen faktiskt gör. Vår egen beröring med
 * Bilder är delningsmenyns "Spara bild".
 *
 * Ett bygge som avvisas syns först efter en uppladdning och en väntan. Därför
 * står kravet här i stället: varje behörighet iOS kräver en text för ska ha
 * en, och varje behörighet appen inte behöver ska vara spärrad.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ROT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, '$1');

interface Konfig {
  readonly expo: {
    readonly ios?: { readonly infoPlist?: Readonly<Record<string, unknown>> };
    readonly android?: {
      readonly permissions?: readonly string[];
      readonly blockedPermissions?: readonly string[];
    };
  };
}

function konfigen(): Konfig['expo'] {
  return (JSON.parse(readFileSync(ROT + 'app.json', 'utf8')) as Konfig).expo;
}

test('varje behorighet iOS fragar om har en svensk text', () => {
  const plist = konfigen().ios?.infoPlist ?? {};
  const kraven = [
    'NSPhotoLibraryUsageDescription',
    'NSPhotoLibraryAddUsageDescription',
    'NSMicrophoneUsageDescription',
    'NSSpeechRecognitionUsageDescription',
  ];
  for (const nyckel of kraven) {
    const text = plist[nyckel];
    assert.equal(typeof text, 'string', `${nyckel} saknas i ios.infoPlist`);
    // Kort och tom text duger inte: Apple laser den, och sa gor anvandaren.
    assert.ok((text as string).length >= 40, `${nyckel}: texten ar for kort`);
    assert.ok(
      /[åäöÅÄÖ]|som|när|din/u.test(text as string),
      `${nyckel}: texten ska vara pa svenska`,
    );
  }
});

test('appen spärrar det den inte behöver, och behåller det den behöver', () => {
  const android = konfigen().android ?? {};
  const spärrade = android.blockedPermissions ?? [];
  for (const p of [
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
    'android.permission.READ_MEDIA_IMAGES',
  ]) {
    assert.ok(spärrade.includes(p), `${p} ska vara spärrad`);
  }
  // Mikrofonen är det enda appen frågar om.
  assert.deepEqual(android.permissions, ['android.permission.RECORD_AUDIO']);
  // Och inget får vara både begärt och spärrat.
  for (const p of android.permissions ?? []) {
    assert.ok(!spärrade.includes(p), `${p} ar bade begard och sparrad`);
  }
});
