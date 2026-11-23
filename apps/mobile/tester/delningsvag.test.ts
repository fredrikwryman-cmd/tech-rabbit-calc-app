/**
 * Hela vägen från svaret på nätet till props i delningsbilden.
 *
 * Direktiv 24 testade `delningsbildensRader` mot ett resultat ur motorn, och
 * testet var grönt — men bilden på telefonen hade inga rader. Gapet låg
 * MELLAN delarna: appens egen svarsläsare (`lasSvar` i lib/api-tolkare.ts)
 * hade en kopia av listan över giltiga faktumnycklar, och kopian saknade
 * `personer` och `perPerson`. Fakta föll bort, `valjVy` svarade 'standard',
 * och raderna blev tomma.
 *
 * Det här testet går därför hela vägen: motorns resultat → JSON över nätet →
 * `lasSvar` → precis de props Dela-knappen skickar till Delningskort. Ett
 * fält som faller bort någonstans på vägen fäller testet.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { margin, splitCost, workTime } from '@techrabbit/engine';

import { lasSvar } from '../lib/api-tolkare.ts';
import { delningsbildensHuvudsvar, delningsbildensRader, valjVy } from '../lib/resultatvy.ts';
import type { Svar } from '../lib/tolkning.ts';

/** Svaret som appen faktiskt får: motorns resultat genom JSON. */
function overNatet(resultat: ReturnType<typeof splitCost>, etikett: string): Svar {
  const kropp: unknown = JSON.parse(
    JSON.stringify({ sort: 'svar', etikett, resultat, forklaring: 'Förklaring.' }),
  );
  const svar = lasSvar(kropp);
  assert.equal(svar.sort, 'svar', 'svaret skulle läsas som ett svar');
  return svar as Svar;
}

/** Props som Dela-knappen bygger i app/(tabs)/index.tsx. */
function delningsprops(svar: Svar, fraga: string): {
  fraga: string;
  etikett: string;
  varde: string;
  enhet: string;
  villkor: readonly string[];
  rader: readonly { etikett: string; varde: string }[];
} {
  return {
    fraga,
    ...delningsbildensHuvudsvar(svar.resultat, svar.etikett),
    villkor: svar.resultat.villkor ?? [],
    rader: delningsbildensRader(svar.resultat),
  };
}

const FRAGA = 'A betalade 900kr, B 300kr, C inget. Dela lika på tre';

test('vagen: fakta overlever natet, sa vy 31 valjs', () => {
  const svar = overNatet(splitCost([{ betalat: 900 }, { betalat: 300 }, { betalat: 0 }]), 'Så går det jämnt ut');
  assert.deepEqual(
    (svar.resultat.fakta ?? []).map((f) => f.nyckel),
    ['belopp', 'personer', 'perPerson', 'resultat'],
  );
  assert.equal(valjVy(svar.resultat), 'dela');
});

test('vagen: Dela-knappens props bar overforingarna', () => {
  const svar = overNatet(splitCost([{ betalat: 900 }, { betalat: 300 }, { betalat: 0 }]), 'Så går det jämnt ut');
  const props = delningsprops(svar, FRAGA);
  assert.deepEqual(props.rader, [
    { etikett: 'C → A betalar', varde: '400,00 kr' },
    { etikett: 'B → A betalar', varde: '100,00 kr' },
  ]);
  assert.ok(props.rader.length <= 4, 'högst fyra rader får nå bilden');
});

test('vagen: bildens huvudsvar ar samma som skarmens', () => {
  const svar = overNatet(splitCost([{ betalat: 900 }, { betalat: 300 }, { betalat: 0 }]), 'Så går det jämnt ut');
  const props = delningsprops(svar, FRAGA);
  // Skärmen visar antalet överföringar i vy 31, inte beloppet per person.
  assert.equal(props.varde, '2');
  assert.equal(props.enhet, 'överföringar');
  assert.equal(props.etikett, 'Så går det jämnt ut');
});

test('vagen: utan overforingar ar beloppet per person huvudsvaret', () => {
  const svar = overNatet(splitCost([], 4, { total: 1000 }), 'Var och en betalar');
  const props = delningsprops(svar, FRAGA);
  assert.equal(props.varde, '250,00');
  assert.equal(props.enhet, 'kr');
  assert.deepEqual(props.rader, []);
});

test('vagen: andra raknesatt far motorns eget huvudsvar och inga rader', () => {
  const marginal = overNatet(margin(40, 65) as ReturnType<typeof splitCost>, 'Vinstmarginal');
  const props = delningsprops(marginal, 'Köp 40 kr, sälj 65 kr');
  assert.equal(props.varde, marginal.resultat.formatted);
  assert.equal(props.enhet, marginal.resultat.unit);
  assert.deepEqual(props.rader, []);
});

test('vagen: arbetstidens fakta overlever ocksa, bade tid och lon', () => {
  const tid = overNatet(
    workTime([{ start: '08:00', slut: '16:00', rast: 30 }], {
      timlon: 200,
      huvudsvar: 'tid',
    }) as ReturnType<typeof splitCost>,
    'Arbetad tid',
  );
  assert.equal(valjVy(tid.resultat), 'arbetstid');
  assert.ok((tid.resultat.fakta ?? []).some((f) => f.nyckel === 'lon'));
  assert.equal(delningsbildensHuvudsvar(tid.resultat, 'Arbetad tid').varde, '7 h 30 min');
});
