/**
 * Chattens tråd (direktiv 40): grupper, svansar, datumrubriker, tiden i
 * bubblan och uträkningen som kommer hem från Räkna.
 *
 * `lib/chatt-trad.ts` är ren och importeras rakt in. Inget test rör nätet,
 * lagringen eller React Native.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  GRUPP_MS,
  LUCKA_INOM,
  LUCKA_MELLAN,
  byggTrad,
  datumrubrik,
  hittaRaknat,
  inverterat,
  medGrupper,
  naraITid,
  tidIBubbla,
} from '../lib/chatt-trad.ts';

/** Ett meddelande med bara det tråden bryr sig om. */
function m(roll: 'jag' | 'du', minut: number, dag = 15): { roll: string; at: number } {
  return { roll, at: new Date(2026, 10, dag, 12, minut, 0).getTime() };
}

describe('medGrupper', () => {
  it('sätter svans bara på gruppens sista bubbla', () => {
    const ut = medGrupper([m('jag', 0), m('jag', 1), m('jag', 2)]);
    assert.deepEqual(
      ut.map((x) => x.sist),
      [false, false, true],
      'bara den sista bär svansen',
    );
    assert.deepEqual(
      ut.map((x) => x.forst),
      [true, false, false],
      'bara den första är först i gruppen',
    );
  });

  it('bryter gruppen när avsändaren byts', () => {
    const ut = medGrupper([m('jag', 0), m('du', 0), m('jag', 1)]);
    assert.deepEqual(
      ut.map((x) => x.sist),
      [true, true, true],
      'tre avsändarbyten ger tre svansar',
    );
  });

  it('bryter gruppen efter tre minuter', () => {
    const nara = medGrupper([m('jag', 0), m('jag', 2)]);
    assert.equal(nara[0]?.sist, false, 'två minuter håller samman gruppen');

    const langt = medGrupper([m('jag', 0), m('jag', 4)]);
    assert.equal(langt[0]?.sist, true, 'fyra minuter bryter gruppen');
  });

  it('grupperar på avsändaren när tiden saknas', () => {
    // Trådar sparade före direktiv 40 bär ingen tid.
    const ut = medGrupper([{ roll: 'jag' }, { roll: 'jag' }, { roll: 'du' }]);
    assert.deepEqual(
      ut.map((x) => x.sist),
      [false, true, true],
      'gammal tråd grupperas på avsändaren ensam',
    );
  });

  it('lämnar ett tomt fält tomt', () => {
    assert.deepEqual(medGrupper([]), []);
  });
});

describe('naraITid', () => {
  it('går vid gruppgränsen', () => {
    const a = { roll: 'jag', at: 1_000_000 };
    assert.equal(naraITid(a, { roll: 'jag', at: 1_000_000 + GRUPP_MS - 1 }), true);
    assert.equal(naraITid(a, { roll: 'jag', at: 1_000_000 + GRUPP_MS }), false);
  });

  it('räknar bakåt lika som framåt', () => {
    const sent = { roll: 'jag', at: 5_000_000 };
    const tidigt = { roll: 'jag', at: 5_000_000 - GRUPP_MS - 1 };
    assert.equal(naraITid(sent, tidigt), false);
  });
});

describe('datumrubrik', () => {
  const nu = new Date(2026, 10, 25, 9, 0, 0);

  it('säger Idag, Igår och datum', () => {
    assert.equal(datumrubrik(new Date(2026, 10, 25, 1, 0, 0).getTime(), nu), 'Idag');
    assert.equal(datumrubrik(new Date(2026, 10, 24, 23, 0, 0).getTime(), nu), 'Igår');
    assert.equal(datumrubrik(new Date(2026, 6, 8, 12, 0, 0).getTime(), nu), '8 jul');
  });

  it('ger tom text för en trasig tid', () => {
    assert.equal(datumrubrik(Number.NaN, nu), '');
  });
});

describe('tidIBubbla', () => {
  it('skriver timme och minut med nolla framför', () => {
    assert.equal(tidIBubbla(new Date(2026, 10, 25, 9, 5, 0).getTime()), '09:05');
    assert.equal(tidIBubbla(new Date(2026, 10, 25, 15, 55, 0).getTime()), '15:55');
  });

  it('visar ingen tid när meddelandet saknar den', () => {
    assert.equal(tidIBubbla(undefined), '');
    assert.equal(tidIBubbla(Number.NaN), '');
  });
});

describe('byggTrad', () => {
  const nu = new Date(2026, 10, 15, 13, 0, 0);

  it('lägger en datumrubrik före dagens första meddelande', () => {
    const ut = byggTrad([m('jag', 0), m('du', 1)], nu);
    assert.equal(ut[0]?.sort, 'datum');
    assert.equal(ut[0]?.sort === 'datum' ? ut[0].text : '', 'Idag');
    assert.equal(ut.filter((p) => p.sort === 'datum').length, 1, 'en rubrik per dag');
  });

  it('lägger en ny rubrik vid dygnsbyte', () => {
    const ut = byggTrad([m('jag', 0, 14), m('du', 0, 15)], nu);
    const rubriker = ut.flatMap((p) => (p.sort === 'datum' ? [p.text] : []));
    assert.deepEqual(rubriker, ['Igår', 'Idag']);
  });

  it('ger ingen rubrik när tiden saknas', () => {
    const ut = byggTrad([{ roll: 'jag' }, { roll: 'du' }], nu);
    assert.equal(ut.filter((p) => p.sort === 'datum').length, 0);
    assert.equal(ut.length, 2);
  });

  it('håller luckorna: 3 pt inom gruppen, 12 pt mellan', () => {
    const ut = byggTrad([m('jag', 0), m('jag', 1), m('du', 1)], nu).flatMap((p) =>
      p.sort === 'meddelande' ? [p.lucka] : [],
    );
    assert.deepEqual(ut, [0, LUCKA_INOM, LUCKA_MELLAN], 'första posten bär ingen lucka');
  });

  it('ger varje post en egen nyckel', () => {
    const ut = byggTrad([m('jag', 0), m('jag', 0), m('du', 1)], nu);
    const nycklar = ut.map((p) => p.nyckel);
    assert.equal(new Set(nycklar).size, nycklar.length, 'inga dubbletter bland nycklarna');
  });

  it('numrerar posterna i läsordning', () => {
    const ut = byggTrad([m('jag', 0), m('du', 1)], nu).flatMap((p) =>
      p.sort === 'meddelande' ? [p.nr] : [],
    );
    assert.deepEqual(ut, [0, 1]);
  });
});

describe('inverterat', () => {
  it('vänder listan utan att röra originalet', () => {
    const in_ = [1, 2, 3];
    assert.deepEqual(inverterat(in_), [3, 2, 1]);
    assert.deepEqual(in_, [1, 2, 3], 'originalet ligger kvar');
  });
});

describe('hittaRaknat', () => {
  const nar = new Date(2026, 10, 25, 12, 0, 0).getTime();
  function post(id: string, fraga: string, minuter: number) {
    return { id, fraga, datum: new Date(nar + minuter * 60_000).toISOString() };
  }

  it('hittar posten Räkna sparade för frågan', () => {
    const p = post('p1', 'Vad kostar 3 kg äpplen?', 1);
    assert.equal(hittaRaknat([p], { fraga: 'Vad kostar 3 kg äpplen?', nar })?.id, 'p1');
  });

  it('struntar i versaler och extra blanksteg', () => {
    const p = post('p1', '  vad   kostar 3 KG äpplen? ', 1);
    assert.equal(hittaRaknat([p], { fraga: 'Vad kostar 3 kg äpplen?', nar })?.id, 'p1');
  });

  it('tar inte en post som sparades före överlämningen', () => {
    const gammal = post('p0', 'Samma fråga', -60);
    assert.equal(hittaRaknat([gammal], { fraga: 'Samma fråga', nar }), null);
  });

  it('tar en post som sparades strax före, inom slacken', () => {
    const p = { id: 'p1', fraga: 'Samma fråga', datum: new Date(nar - 1_000).toISOString() };
    assert.equal(hittaRaknat([p], { fraga: 'Samma fråga', nar })?.id, 'p1');
  });

  it('hoppar över det som redan ligger i tråden', () => {
    const p = post('p1', 'Samma fråga', 1);
    assert.equal(hittaRaknat([p], { fraga: 'Samma fråga', nar }, ['p1']), null);
  });

  it('tar den nyaste när samma fråga räknats flera gånger', () => {
    const a = post('a', 'Samma fråga', 1);
    const b = post('b', 'Samma fråga', 5);
    assert.equal(hittaRaknat([a, b], { fraga: 'Samma fråga', nar })?.id, 'b');
    assert.equal(hittaRaknat([b, a], { fraga: 'Samma fråga', nar })?.id, 'b');
  });

  it('svarar null på en tom fråga och på en trasig tid', () => {
    assert.equal(hittaRaknat([post('p1', 'x', 1)], { fraga: '   ', nar }), null);
    assert.equal(
      hittaRaknat([{ id: 'p1', fraga: 'x', datum: 'inte ett datum' }], { fraga: 'x', nar }),
      null,
    );
  });
});

/**
 * Chattvyn går inte att rendera i ren Node — den importerar React Native —
 * så besluten läses ur källkoden, precis som rörelsetokenen i
 * rorelse.test.ts. Det som ska skyddas är att vyn verkligen bär rev-ux
 * mönster, inte hur en bubbla råkar ritas.
 */
describe('chattvyn (direktiv 40)', () => {
  const vyn = readFileSync(join(import.meta.dirname, '..', 'komponenter', 'RabbitAI.tsx'), 'utf8');
  const skarmen = readFileSync(
    join(import.meta.dirname, '..', 'app', '(tabs)', 'rabbit-ai.tsx'),
    'utf8',
  );

  it('ritar tråden som en inverterad lista', () => {
    assert.match(vyn, /<FlatList\b/u, 'tråden ska vara en FlatList');
    // Indraget raknas inte: direktiv 41 lade en KeyboardGestureArea runt
    // listan, och da flyttade hela tradens kropp tva steg in.
    assert.match(vyn, /\n\s+inverted\n/u, 'listan ska vara inverterad (steg 1)');
    assert.ok(!vyn.includes('scrollToEnd'), 'en inverterad lista scrollar inte till slutet');
  });

  it('bygger tråden ur chatt-trad i stället för att gruppera i vyn', () => {
    assert.match(vyn, /byggTrad\(meddelanden\)/u);
    assert.match(vyn, /inverterat\(/u);
    assert.match(vyn, /tidIBubbla\(/u, 'tiden i bubblan kommer ur modulen');
  });

  it('animerar svansen med rm.swap', () => {
    assert.match(
      vyn,
      /borderBottomRightRadius: BUBBELRADIE - \(BUBBELRADIE - SVANSRADIE\) \* svans\.value/u,
      'svansen ska vara en animerad hörnradie',
    );
    assert.match(vyn, /duration: rorelse\.reducerad \? REDUCERAD_MS : rm\.swap/u);
  });

  it('visar kaninen bara vid gruppens sista svar', () => {
    assert.match(vyn, /sist \? \(\s*<AiKaninLiten hojd=\{KANIN_LITEN_PT\} \/>/u);
  });

  it('har en handlingsrad mellan tråden och fältet', () => {
    assert.match(vyn, /function Handlingsrad\(/u);
    assert.match(vyn, /<Handlingsrad\b/u);
  });

  it('byter mikrofonen mot skicka-pilen på en och samma plats', () => {
    assert.match(vyn, /function Faltknapp\(/u);
    assert.match(vyn, /scale: 0\.6 \+ 0\.4 \*/u, 'skalan ska gå 0.6 → 1 (rev-ux 5.4)');
    assert.equal(
      (vyn.match(/<Mikrofonknapp/gu) ?? []).length,
      1,
      'mikrofonen ska finnas på ett ställe, inte två',
    );
  });

  it('låter tangentbordet ligga kvar när frågan skickas', () => {
    const skicka = vyn.slice(vyn.indexOf('function Faltknapp('));
    assert.ok(
      !/onSkicka[\s\S]{0,200}Keyboard\.dismiss/u.test(skicka),
      'skicka får inte stänga tangentbordet (rev-ux 5.4)',
    );
  });

  it('bär en pill för nytt svar och en meny vid långtryck', () => {
    assert.match(vyn, /function Nyttpill\(/u);
    assert.match(vyn, /function Bubbelmeny\(/u);
    assert.match(vyn, /haptik\('medel'\)/u, 'långtryck ger medium (haptikkartan)');
  });

  it('skickar tiden med varje nytt meddelande', () => {
    assert.match(skarmen, /roll: 'jag', text: fragan, at: Date\.now\(\)/u);
    assert.equal(
      (skarmen.match(/at: Date\.now\(\)/gu) ?? []).length,
      4,
      'frågan och alla tre svarsvägar ska bära tid',
    );
  });

  it('hämtar hem uträkningen ur historiken och bekräftar med haptik', () => {
    assert.match(skarmen, /hittaRaknat\(historik, vantar, redan\)/u);
    assert.match(skarmen, /haptic\('bekraftelse'\)/u);
    assert.match(skarmen, /raknatId: post\.id/u, 'kortet ska bära id:t, inte en kopia av svaret');
  });
});
