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

test('beteendet ar detsamma pa bada plattformarna', () => {
  const kod = readFileSync(join(ROT, 'komponenter', 'Tangentbord.tsx'), 'utf8');
  /*
    Direktiv 33 satte 'height' pa Android, eftersom React Natives egen
    KeyboardAvoidingView inte flyttade nagonting dar. Direktiv 41 bytte vyn
    mot react-native-keyboard-controller, som foljer tangentbordets exakta
    kurva LIKA pa bada plattformarna — da ska beteendet inte langre skilja
    sig, och 'padding' galler bada.

    Det gamla kravet var att beteendet var satt for bada plattformar. Det
    galler fortfarande; det ar VARDET som inte langre behover vara tva.
  */
  assert.match(
    kod,
    /TANGENTBORDSBETEENDE = 'padding'/u,
    'beteendet ska vara ett och samma for bada plattformarna',
  );
  assert.ok(
    !/TANGENTBORDSBETEENDE = Platform\.OS/u.test(kod),
    'beteendet far inte bero pa plattform langre',
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
    /*
      Direktiv 41: "interactive" duger ocksa — det ar samma vag ut, men
      tangentbordet foljer fingret pa vagen ner. Kravet ar att listan HAR en
      vag ut, inte vilken av de tva den ar.
    */
    assert.match(
      kod,
      /keyboardDismissMode="(on-drag|interactive)"/u,
      `${delar.join('/')}: listan saknar keyboardDismissMode`,
    );
  }
});

test('traden och Rakna-faltet drar ned tangentbordet med fingret', () => {
  /*
    Direktiv 41 steg 2: tangentbordet ska folja fingret nar man drar ned det
    i chattens trad och i Rakna-faltet. Pa iOS gor keyboardDismissMode det;
    pa Android kravs KeyboardGestureArea runt listan. Bada maste finnas,
    annars ar gesten bara halv — och bara pa en plattform.
  */
  for (const delar of [
    ['komponenter', 'RabbitAI.tsx'],
    ['app', '(tabs)', 'index.tsx'],
  ] as const) {
    const namn = delar.join('/');
    const kod = readFileSync(join(ROT, ...delar), 'utf8');
    assert.match(kod, /keyboardDismissMode="interactive"/u, `${namn}: inte interaktivt`);
    assert.match(
      kod,
      /<KeyboardGestureArea /u,
      `${namn}: Android saknar gestytan runt listan`,
    );
    assert.match(
      kod,
      /import \{[^}]*KeyboardGestureArea[^}]*\} from 'react-native-keyboard-controller';/su,
      `${namn}: KeyboardGestureArea ska komma ur react-native-keyboard-controller`,
    );
  }
});

test('tangentbordsvyerna kommer ur keyboard-controller, med provider i roten', () => {
  /*
    Direktiv 41: den exakta kurvan kraver att KeyboardAvoidingView kommer ur
    react-native-keyboard-controller OCH att KeyboardProvider ligger over
    allt som har ett falt. Utan providern gor vyn ingenting — tyst, vilket
    ar varre an ett fel.
  */
  let antal = 0;
  for (const [namn, kod] of filerna()) {
    if (!kod.includes('<KeyboardAvoidingView')) continue;
    antal += 1;
    assert.ok(
      /import \{[^}]*KeyboardAvoidingView[^}]*\} from 'react-native-keyboard-controller';/su.test(
        kod,
      ),
      `${namn}: KeyboardAvoidingView ska komma ur react-native-keyboard-controller`,
    );
    const rnImport = /import \{[^}]*\} from 'react-native';/su.exec(kod)?.[0] ?? '';
    assert.ok(
      !/KeyboardAvoidingView/u.test(rnImport),
      `${namn}: React Natives egen KeyboardAvoidingView ligger kvar`,
    );
    assert.ok(
      kod.includes('automaticOffset'),
      `${namn}: vyn ska mata sitt eget lage (automaticOffset)`,
    );
  }
  assert.ok(antal >= 3, `hittade bara ${antal} vyer med KeyboardAvoidingView`);

  const rot = readFileSync(join(ROT, 'app', '_layout.tsx'), 'utf8');
  assert.match(rot, /<KeyboardProvider>/u, 'KeyboardProvider saknas i roten');
  assert.match(
    rot,
    /import \{ KeyboardProvider \} from 'react-native-keyboard-controller';/u,
  );
});
