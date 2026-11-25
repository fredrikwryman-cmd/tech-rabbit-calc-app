/**
 * Historikens dagsgrupper och klistriga rubriker (direktiv 41 steg 3).
 *
 * `lib/historikgrupper.ts` är ren och importeras rakt in.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { grupperaPaDag, rubrikplatser } from '../lib/historikgrupper.ts';

function post(id: string, ar: number, manad: number, dag: number, timme = 12) {
  return { id, datum: new Date(ar, manad, dag, timme, 0, 0).toISOString() };
}

const nu = new Date(2026, 10, 25, 9, 0, 0);

describe('grupperaPaDag', () => {
  it('lägger dagens poster under Idag', () => {
    const ut = grupperaPaDag([post('a', 2026, 10, 25, 8), post('b', 2026, 10, 25, 1)], nu);
    assert.equal(ut.length, 1);
    assert.equal(ut[0]?.rubrik, 'Idag');
    assert.deepEqual(ut[0]?.poster.map((p) => p.id), ['a', 'b']);
  });

  it('delar på dygnsgränsen och behåller ordningen', () => {
    const ut = grupperaPaDag(
      [post('a', 2026, 10, 25), post('b', 2026, 10, 24), post('c', 2026, 6, 8)],
      nu,
    );
    assert.deepEqual(ut.map((g) => g.rubrik), ['Idag', 'Igår', '8 jul']);
    assert.deepEqual(ut.map((g) => g.poster.length), [1, 1, 1]);
  });

  it('startar en ny grupp när dagen kommer tillbaka senare i listan', () => {
    // Historiken sorteras inte om: en post med ett avvikande datum ska ligga
    // kvar där den låg, inte hoppa upp i en tidigare grupp.
    const ut = grupperaPaDag(
      [post('a', 2026, 10, 25), post('b', 2026, 10, 24), post('c', 2026, 10, 25)],
      nu,
    );
    assert.deepEqual(ut.map((g) => g.rubrik), ['Idag', 'Igår', 'Idag']);
    assert.deepEqual(ut.map((g) => g.poster.map((p) => p.id)), [['a'], ['b'], ['c']]);
  });

  it('samlar poster med trasigt datum sist, utan rubrik', () => {
    const ut = grupperaPaDag(
      [post('a', 2026, 10, 25), { id: 'trasig', datum: 'inte ett datum' }],
      nu,
    );
    assert.equal(ut.length, 2);
    assert.equal(ut[1]?.rubrik, '');
    assert.deepEqual(ut[1]?.poster.map((p) => p.id), ['trasig']);
  });

  it('ger varje grupp en egen nyckel', () => {
    const ut = grupperaPaDag([post('a', 2026, 10, 25), post('b', 2026, 10, 24)], nu);
    const nycklar = ut.map((g) => g.nyckel);
    assert.equal(new Set(nycklar).size, nycklar.length);
  });

  it('lämnar en tom historik tom', () => {
    assert.deepEqual(grupperaPaDag([], nu), []);
  });
});

describe('rubrikplatser', () => {
  it('pekar på varannat barn, från det första', () => {
    assert.deepEqual(rubrikplatser(3), [0, 2, 4]);
    assert.deepEqual(rubrikplatser(0), []);
  });
});

describe('historikvyn och svepet (direktiv 41)', () => {
  const vyn = readFileSync(
    join(import.meta.dirname, '..', 'app', '(tabs)', 'historik.tsx'),
    'utf8',
  );
  const svepbar = readFileSync(
    join(import.meta.dirname, '..', 'komponenter', 'Svepbar.tsx'),
    'utf8',
  );
  const raden = readFileSync(
    join(import.meta.dirname, '..', 'komponenter', 'Historikrad.tsx'),
    'utf8',
  );

  it('ritar klistriga datumrubriker ur grupperingen', () => {
    assert.match(vyn, /grupperaPaDag\(/u);
    assert.match(vyn, /stickyHeaderIndices=\{rubrikplatser\(/u);
  });

  it('frågar innan en rad tas bort, och varnar med haptik', () => {
    assert.match(svepbar, /bekrafta\?:/u, 'Svepbar ska kunna fråga först');
    assert.match(raden, /<Bekraftelsedialog/u, 'raden ska bära bekräftelseraden');
    assert.match(raden, /haptik\('varning'\)/u, 'haptic warning före borttagningen');
  });

  it('fäller ihop raden innan den tas bort på riktigt', () => {
    assert.match(svepbar, /runOnJS\(onTaBort\)\(\)/u);
    assert.match(svepbar, /hojd\.value = withTiming\(0/u);
  });
});
