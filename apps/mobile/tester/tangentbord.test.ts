/**
 * Tangentbordet får aldrig stänga in användaren (direktiv 32).
 *
 * Sett på telefonen: sifferknappsatsen täckte Skicka och Räkna, och gick inte
 * att stänga. Enda vägen ut var att skicka frågan.
 *
 * Det här är ett källäsande test, som avtalstesterna: det kan inte se en
 * telefon, men det kan se att varje fält har en väg ut, och det faller den
 * dag någon lägger till ett fält utan en. Att raden fungerar på riktigt är
 * mätt på telefonen, inte här.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, '$1');

/** Varje .tsx under komponenter och app, med sin text. */
function filerna(): ReadonlyArray<readonly [string, string]> {
  const ut: Array<readonly [string, string]> = [];
  const mappar = [join(ROT, 'komponenter'), join(ROT, 'app'), join(ROT, 'app', '(tabs)')];
  for (const mapp of mappar) {
    for (const namn of readdirSync(mapp)) {
      if (!namn.endsWith('.tsx')) continue;
      ut.push([`${mapp.split(/[\\/]/u).pop() ?? ''}/${namn}`, readFileSync(join(mapp, namn), 'utf8')]);
    }
  }
  return ut;
}

/**
 * Varje TextInput-element i en fil, som text från taggen till ">".
 *
 * Mönstret kräver ett tecken efter namnet, annars fastnar `<TextInput` i
 * `forwardRef<TextInputInstance, …>` — en typparameter, inget fält.
 */
function faltenI(kod: string): readonly string[] {
  const ut: string[] = [];
  const taggen = /<TextInput(?=[\s/>])/gu;
  const start = [...kod.matchAll(taggen)].map((m) => m.index);
  let i = start.shift() ?? -1;
  while (i !== -1) {
    // Elementet slutar vid första "/>" eller ">" som inte ligger i en {}-del.
    let djup = 0;
    let j = i;
    for (; j < kod.length; j += 1) {
      const t = kod[j];
      if (t === '{') djup += 1;
      else if (t === '}') djup -= 1;
      else if (t === '>' && djup === 0) break;
    }
    ut.push(kod.slice(i, j));
    i = start.shift() ?? -1;
  }
  return ut;
}

test('varje falt har ett satt att stanga tangentbordet utan att skicka', () => {
  let antal = 0;
  for (const [namn, kod] of filerna()) {
    for (const falt of faltenI(kod)) {
      antal += 1;
      assert.match(
        falt,
        /inputAccessoryViewID=\{KLAR_ID/u,
        `${namn}: faltet saknar Klar-rad (inputAccessoryViewID)`,
      );
    }
  }
  // Faller antalet till noll har testet slutat leta, och sager ingenting.
  assert.ok(antal >= 5, `hittade bara ${antal} falt`);
});

test('varje id ett falt pekar pa ritas ocksa som en Klar-rad', () => {
  const alla = filerna();
  const samlad = alla.map(([, kod]) => kod).join('\n');
  const idn = new Set<string>();
  for (const [, kod] of alla) {
    for (const falt of faltenI(kod)) {
      const m = /inputAccessoryViewID=\{(KLAR_ID[A-Z_]*)\}/u.exec(falt);
      if (m?.[1] !== undefined) idn.add(m[1]);
    }
  }
  assert.ok(idn.size >= 2, 'minst tva olika id forvantas');
  for (const id of idn) {
    const ritas =
      id === 'KLAR_ID'
        ? /<Klarrad \/>/u.test(samlad)
        : new RegExp(`<Klarrad id=\\{${id}\\}`, 'u').test(samlad);
    assert.ok(ritas, `${id} pekas pa av ett falt men ritas aldrig`);
  }
});

test('Klar-raden stanger tangentbordet, den skickar ingenting', () => {
  const kod = readFileSync(join(ROT, 'komponenter', 'Tangentbord.tsx'), 'utf8');
  assert.match(kod, /InputAccessoryView/u, 'raden ska vara en InputAccessoryView');
  assert.match(kod, /Keyboard\.dismiss\(\)/u, 'Klar ska stanga tangentbordet');
  assert.match(kod, /accessibilityLabel="Klar"/u);
  // Ingen ny inbyggd modul: raden far bara anvanda react-native.
  const importer = [...kod.matchAll(/from '([^']+)'/gu)].map((m) => m[1] ?? '');
  for (const i of importer) {
    assert.ok(
      i === 'react' || i === 'react-native' || i.startsWith('../'),
      `ovantat beroende: ${i}`,
    );
  }
});

test('ett tryck utanfor faltet stanger tangentbordet', () => {
  const skarm = readFileSync(join(ROT, 'komponenter', 'Skarm.tsx'), 'utf8');
  assert.match(skarm, /onPress=\{\(\) => Keyboard\.dismiss\(\)\}/u, 'Skarm ska stanga vid tryck');
  assert.match(skarm, /<Klarrad \/>/u, 'Skarm ska rita skarmens Klar-rad');
});

test('Klar-raden ritas bara pa iOS', () => {
  const kod = readFileSync(join(ROT, 'komponenter', 'Tangentbord.tsx'), 'utf8');
  assert.match(
    kod,
    /if \(Platform\.OS !== 'ios'\) return null;/u,
    'Android har en egen bakatvag ur tangentbordet och ska inte ha raden',
  );
});

test('Android flyttar innehallet, iOS lagger till utrymme', () => {
  const kod = readFileSync(join(ROT, 'komponenter', 'Tangentbord.tsx'), 'utf8');
  // 'height' pa Android: fonstret krymper, och vyn foljer med. Stod det
  // undefined — som det gjorde fore direktiv 33 — flyttades ingenting alls.
  assert.match(
    kod,
    /TANGENTBORDSBETEENDE = Platform\.OS === 'ios' \? 'padding' : 'height'/u,
    'beteendet ska vara satt for bada plattformarna',
  );

  // Och ingen vy far ha en egen kopia av ternaren kvar.
  for (const [namn, fil] of filerna()) {
    if (!fil.includes('KeyboardAvoidingView')) continue;
    for (const rad of fil.split('\n')) {
      if (!rad.includes('behavior=')) continue;
      assert.match(
        rad,
        /behavior=\{TANGENTBORDSBETEENDE\}/u,
        `${namn}: beteendet ska lasas ur Tangentbord.tsx`,
      );
    }
  }
});

test('fonstret krymper nar tangentbordet kommer upp pa Android', () => {
  const konfig = JSON.parse(readFileSync(join(ROT, 'app.json'), 'utf8')) as {
    expo: { android?: { softwareKeyboardLayoutMode?: string } };
  };
  // 'resize' ar det som gor att 'height' ovanfor har nagot att folja.
  assert.equal(konfig.expo.android?.softwareKeyboardLayoutMode, 'resize');
});

test('tryck utanfor faltet stanger tangentbordet pa bada plattformarna', () => {
  for (const delar of [
    ['komponenter', 'Skarm.tsx'],
    ['komponenter', 'RabbitAI.tsx'],
  ] as const) {
    const kod = readFileSync(join(ROT, ...delar), 'utf8');
    assert.match(kod, /Keyboard\.dismiss\(\)/u, `${delar.join('/')}: inget tryck stanger`);
    assert.ok(
      !kod.includes('Platform.OS'),
      `${delar.join('/')}: vagen ut far inte bero pa plattform`,
    );
  }
});

test('listor med falt stanger tangentbordet nar man drar', () => {
  const krav = [
    ['komponenter', 'Sheet.tsx'],
    ['komponenter', 'ResultatSheet.tsx'],
    ['komponenter', 'RabbitAI.tsx'],
    ['app', '(tabs)', 'index.tsx'],
  ] as const;
  for (const delar of krav) {
    const kod = readFileSync(join(ROT, ...delar), 'utf8');
    assert.match(
      kod,
      /keyboardDismissMode="on-drag"/u,
      `${delar.join('/')}: listan saknar keyboardDismissMode`,
    );
  }
});
