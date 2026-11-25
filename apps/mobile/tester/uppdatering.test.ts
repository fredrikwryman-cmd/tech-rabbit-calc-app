/**
 * Vakttest för utgivningen av appuppdateringar (direktiv 38).
 *
 * Två fel har redan hänt i verkligheten: en uppdatering gick bara till
 * kanalen `preview`, så TestFlight-bygget stod kvar på gammal kod, och en gick
 * till `production` med en EAS-miljö utan EXPO_PUBLIC_API_URL, så appen tappade
 * adressen till tolkningstjänsten.
 *
 * Testet läser filerna, inte EAS. Det slår alltså fel när eas.json börjar peka
 * på olika serveradresser i olika byggprofiler, när utgivningsskriptet slutar
 * täcka båda grenarna, eller när adressen i skriptets kontroll glider ifrån
 * eas.json. Själva avstämningen mot de riktiga EAS-miljöerna görs av skriptet
 * vid varje körning, eftersom den kräver nätet.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const MOBIL = join(import.meta.dirname, '..');
const ROT = join(MOBIL, '..', '..');
const SKRIPT = join(ROT, 'verktyg', 'uppdatera.mjs');

const VARIABEL = 'EXPO_PUBLIC_API_URL';
/** Grenarna appen hämtar uppdateringar från. Båda måste täckas. */
const GRENAR = ['preview', 'production'];

type EasJson = {
  readonly build?: Record<string, { readonly env?: Record<string, string> }>;
};

function easJson(): EasJson {
  return JSON.parse(readFileSync(join(MOBIL, 'eas.json'), 'utf8')) as EasJson;
}

function skript(): string {
  return readFileSync(SKRIPT, 'utf8');
}

test('eas.json anger serveradressen för varje gren appen uppdateras på', () => {
  const profiler = easJson().build ?? {};
  for (const gren of GRENAR) {
    const adress = profiler[gren]?.env?.[VARIABEL];
    assert.ok(
      adress,
      `eas.json saknar ${VARIABEL} i byggprofilen ${gren}. Ett bygge utan den ` +
        'startar men når aldrig tolkningstjänsten.',
    );
    assert.match(adress, /^https:\/\//, `${VARIABEL} i ${gren} är inte en https-adress`);
  }
});

test('alla byggprofiler pekar på samma serveradress', () => {
  const profiler = easJson().build ?? {};
  const adresser = GRENAR.map((gren) => [gren, profiler[gren]?.env?.[VARIABEL]] as const);
  const unika = new Set(adresser.map(([, adress]) => adress));
  assert.equal(
    unika.size,
    1,
    'Byggprofilerna pekar på olika serveradresser: ' +
      adresser.map(([gren, adress]) => `${gren}=${adress}`).join(', '),
  );
});

test('utgivningsskriptet publicerar till båda grenarna', () => {
  const kallkod = skript();
  for (const gren of GRENAR) {
    assert.ok(
      new RegExp(`gren:\\s*'${gren}'`).test(kallkod),
      `verktyg/uppdatera.mjs saknar grenen ${gren}. Då blir kanalerna osynkade igen.`,
    );
  }
  assert.ok(
    /--skip-bundler/.test(kallkod),
    'Skriptet buntar om per gren i stället för att skicka samma bunt till båda.',
  );
});

test('skriptet kontrollerar samma variabel som appen läser', () => {
  assert.ok(
    new RegExp(`VARIABEL = '${VARIABEL}'`).test(skript()),
    `verktyg/uppdatera.mjs kontrollerar inte ${VARIABEL}.`,
  );
  const appkod = readFileSync(join(MOBIL, 'lib', 'api-tolkare.ts'), 'utf8');
  assert.ok(
    appkod.includes(`process.env['${VARIABEL}']`),
    `Appen läser inte ${VARIABEL} längre. Uppdatera testet och skriptet ihop.`,
  );
});

test('npm run uppdatera finns i roten', () => {
  const paket = JSON.parse(readFileSync(join(ROT, 'package.json'), 'utf8')) as {
    readonly scripts?: Record<string, string>;
  };
  assert.equal(paket.scripts?.['uppdatera'], 'node verktyg/uppdatera.mjs');
});

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

test('bada kanalerna nas fortfarande av utgivningen', () => {
  // Samma krav som direktiv 38 satte, upprepat efter runtime-hojningen: en
  // ny runtime far inte betyda att bara en kanal uppdateras.
  const kallkod = skript();
  for (const gren of GRENAR) {
    assert.ok(
      new RegExp(`gren:\\s*'${gren}'`).test(kallkod),
      `verktyg/uppdatera.mjs saknar grenen ${gren}`,
    );
  }
  assert.ok(
    /--branch/.test(kallkod),
    'skriptet ska publicera per gren med --branch',
  );
});
