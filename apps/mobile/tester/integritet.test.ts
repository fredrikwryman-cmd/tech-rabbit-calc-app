/**
 * Appen i app-vaxlaren, och fragan fore en orakallelig borttagning.
 * rev-ux 2.4 och haptikkartan (direktiv 41 steg 3 och 4).
 *
 * Kallasande test, som tangentbord.test.ts: det kan inte se en telefon, men
 * det kan se att lagret finns dar det maste finnas, och det faller den dag
 * nagon lagger till en borttagning utan fraga.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, '$1');

const las = (...delar: readonly string[]): string =>
  readFileSync(join(ROT, ...delar), 'utf8');

test('slojan lyssnar pa AppState och suddar med expo-blur', () => {
  const kod = las('komponenter', 'Integritetslager.tsx');
  assert.match(kod, /AppState\.addEventListener\('change'/u, 'ingen lyssnare pa AppState');
  // 'inactive' ar laget dar iOS tar bilden till app-vaxlaren. Testet kraver
  // att allt utom 'active' doljer, sa att bade iOS och Android tacks.
  assert.match(kod, /lage !== 'active'/u, 'bara active far rakna som synligt');
  assert.match(kod, /from 'expo-blur'/u, 'suddet ska komma ur expo-blur');
  assert.match(kod, /intensity=\{STYRKA\}/u);
  assert.match(kod, /const STYRKA = 40;/u, 'rev-ux 8.7 sager styrka 40');
  // Ingen intoning: bilden tas inom en brakdel av en sekund, och en intoning
  // hade hunnit bli en halvsuddig bild.
  assert.ok(!/entering=/u.test(kod), 'slojan far inte tona IN');
  assert.match(kod, /exiting=\{FadeOut\.duration\(/u, 'slojan ska tona bort');
  assert.match(kod, /REDUCERAD_MS/u, 'reducerad rorelse ska ge 160 ms');
  assert.ok(!/Haptics|haptik\(/u.test(kod), 'ingen haptik nar telefonen byter app');
});

test('slojan ligger over hela appen och over arken', () => {
  const rot = las('app', '_layout.tsx');
  assert.match(rot, /<Integritetslager>/u, 'roten saknar lagret');
  // Ark och dialoger ritar i egna Modal-fonster, dit ett lager i appens trad
  // inte nar. Darfor ritas slojan en gang till inne i arket.
  const ark = las('komponenter', 'Sheet.tsx');
  assert.match(ark, /<Integritetsslojan \/>/u, 'arket saknar slojan');
});

test('varje orakallelig borttagning fragar forst, med haptic warning', () => {
  const krav = [
    // [fil, det som bar fragan]
    [['komponenter', 'Historikrad.tsx'], 'en rad i historiken'],
    [['komponenter', 'RabbitAI.tsx'], 'ett samtal och alla samtal'],
    [['app', '(tabs)', 'installningar.tsx'], 'rensa historik'],
  ] as const;
  for (const [delar, vad] of krav) {
    const kod = las(...delar);
    assert.match(kod, /<Bekraftelsedialog/u, `${vad}: ingen bekraftelserad`);
    assert.match(kod, /haptik\('varning'\)/u, `${vad}: ingen haptic warning`);
  }
});

test('svepet och menyn gar genom samma fraga', () => {
  // Tva vagar in till samma borttagning, en dialog. Hade de haft en dialog
  // var kunde de glida isar.
  const raden = las('komponenter', 'Historikrad.tsx');
  assert.equal(
    (raden.match(/<Bekraftelsedialog/gu) ?? []).length,
    1,
    'raden ska ha EN dialog',
  );
  assert.match(raden, /bekrafta=\{bekraftaBorttagning\}/u, 'svepet ska fraga');
  assert.match(raden, /bekraftaBorttagning\(onTaBort\)/u, 'menyn ska fraga');
});
