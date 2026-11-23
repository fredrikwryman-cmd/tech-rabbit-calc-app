/**
 * Tester för chattens kärna: SSE-parsningen och tiden kvar till midnatt.
 *
 * Inget test rör nätet, lagringen eller React Native. Körs med Nodes inbyggda
 * testkörare och Nodes typavskalning, precis som räknemotorns tester.
 */

import { strict as assert } from 'node:assert';
import { describe, it, test } from 'node:test';

import { domanUr, kallorUr, las429, Sselasare, tidKvar } from '../lib/chatt-karna.ts';

function block(namn: string, kropp: unknown): string {
  return `event: ${namn}\ndata: ${JSON.stringify(kropp)}\n\n`;
}

describe('Sselasare', () => {
  it('läser en hel händelse', () => {
    const l = new Sselasare();
    const ut = l.las(block('text', { text: 'Hej' }));
    assert.equal(ut.length, 1);
    assert.equal(ut[0]?.namn, 'text');
    assert.equal(ut[0]?.kropp['text'], 'Hej');
  });

  it('läser flera händelser i samma bit', () => {
    const l = new Sselasare();
    const ut = l.las(block('text', { text: 'A' }) + block('text', { text: 'B' }));
    assert.deepEqual(
      ut.map((h) => h.kropp['text']),
      ['A', 'B'],
    );
  });

  it('lämnar en halv händelse och tar den när resten kommer', () => {
    const l = new Sselasare();
    const hel = block('text', { text: 'Hej' });
    const halv = hel.slice(0, 20);

    assert.deepEqual(l.las(halv), [], 'en halv händelse ger inget');

    const ut = l.las(hel);
    assert.equal(ut.length, 1);
    assert.equal(ut[0]?.kropp['text'], 'Hej');
  });

  it('läser aldrig samma händelse två gånger', () => {
    const l = new Sselasare();
    const allt = block('text', { text: 'A' });
    assert.equal(l.las(allt).length, 1);
    assert.equal(l.las(allt).length, 0, 'samma text igen ger inget nytt');
    assert.equal(l.las(allt + block('text', { text: 'B' })).length, 1);
  });

  it('bygger ihop ett svar som kommer i småbitar', () => {
    const l = new Sselasare();
    const strom = block('text', { text: 'Ett ' }) + block('text', { text: 'svar.' });
    let samlat = '';
    let sa_langt = '';
    for (const tecken of strom) {
      sa_langt += tecken;
      for (const h of l.las(sa_langt)) {
        if (h.namn === 'text' && typeof h.kropp['text'] === 'string') samlat += h.kropp['text'];
      }
    }
    assert.equal(samlat, 'Ett svar.');
  });

  it('hoppar över trasig JSON utan att tappa nästa händelse', () => {
    const l = new Sselasare();
    const ut = l.las('event: text\ndata: {detta är inte json\n\n' + block('text', { text: 'B' }));
    assert.equal(ut.length, 1);
    assert.equal(ut[0]?.kropp['text'], 'B');
  });

  it('hoppar över block utan namn eller data', () => {
    const l = new Sselasare();
    assert.deepEqual(l.las(': en kommentar\n\ndata: {}\n\n'), []);
  });

  it('läser räkna- och fel-händelser', () => {
    const l = new Sselasare();
    const ut = l.las(block('rakna', { raknaPa: '25 % moms på 1840 kr' }) + block('fel', {}));
    assert.deepEqual(
      ut.map((h) => h.namn),
      ['rakna', 'fel'],
    );
    assert.equal(ut[0]?.kropp['raknaPa'], '25 % moms på 1840 kr');
  });
});

describe('tidKvar', () => {
  it('ger timmar och minuter', () => {
    assert.equal(tidKvar(6 * 3600 + 12 * 60), '6 h 12 min');
  });

  it('ger bara minuter under en timme', () => {
    assert.equal(tidKvar(45 * 60), '45 min');
  });

  it('ger "en stund" under en minut', () => {
    assert.equal(tidKvar(30), 'en stund');
  });

  it('ger "en stund" för noll, negativt och NaN', () => {
    assert.equal(tidKvar(0), 'en stund');
    assert.equal(tidKvar(-10), 'en stund');
    assert.equal(tidKvar(Number.NaN), 'en stund');
  });

  it('avrundar nedåt, aldrig uppåt', () => {
    // 59 minuter och 59 sekunder är inte "1 h".
    assert.equal(tidKvar(3599), '59 min');
    assert.equal(tidKvar(3600), '1 h 0 min');
  });
});

// ---------------------------------------------------------------------------
// Direktiv 20: sökstatusen och källhändelsen
// ---------------------------------------------------------------------------

test('strommen bar sokning, text, kallor och slut i ordning', () => {
  const lasare = new Sselasare();
  const handelser = lasare.las(
    'event: sokning\ndata: {}\n\n' +
      'event: text\ndata: {"text":"Han spelar i "}\n\n' +
      'event: kallor\ndata: {"kallor":[{"titel":"Laget","adress":"https://nhl.com/a","doman":"nhl.com"}]}\n\n' +
      'event: slut\ndata: {}\n\n',
  );
  assert.deepEqual(
    handelser.map((h) => h.namn),
    ['sokning', 'text', 'kallor', 'slut'],
  );
  assert.deepEqual(handelser[0]?.kropp, {});
  assert.equal(kallorUr(handelser[2]!.kropp).length, 1);
});

test('kallorUr laser titel, adress och doman', () => {
  const kallor = kallorUr({
    kallor: [
      { titel: '  Mika Zibanejad  ', adress: 'https://www.nhl.com/spelare', doman: 'nhl.com' },
    ],
  });
  assert.deepEqual(kallor, [
    { titel: 'Mika Zibanejad', adress: 'https://www.nhl.com/spelare', doman: 'nhl.com' },
  ]);
});

test('kallorUr raknar fram domanen nar servern inte skickade nagon', () => {
  const kallor = kallorUr({ kallor: [{ titel: 'Sida', adress: 'https://www.SVT.se/sport/x' }] });
  assert.equal(kallor[0]?.doman, 'svt.se');
});

test('kallorUr tar titeln ur domanen nar titeln ar tom', () => {
  const kallor = kallorUr({ kallor: [{ titel: '   ', adress: 'https://dn.se/a' }] });
  assert.equal(kallor[0]?.titel, 'dn.se');
});

test('kallorUr slapper bara http och https igenom', () => {
  const kallor = kallorUr({
    kallor: [
      { titel: 'Ond', adress: 'javascript:alert(1)' },
      { titel: 'Fil', adress: 'file:///etc/passwd' },
      { titel: 'App', adress: 'techrabbitkalkylator://x' },
      { titel: 'Ok', adress: 'http://exempel.se/a' },
    ],
  });
  assert.deepEqual(kallor.map((k) => k.adress), ['http://exempel.se/a']);
});

test('kallorUr tar bort dubbletter pa adressen', () => {
  const kallor = kallorUr({
    kallor: [
      { titel: 'En', adress: 'https://a.se/x' },
      { titel: 'En igen', adress: 'https://a.se/x' },
      { titel: 'Annan', adress: 'https://b.se/x' },
    ],
  });
  assert.equal(kallor.length, 2);
});

test('kallorUr tar hogst atta kallor', () => {
  const kallor = kallorUr({
    kallor: Array.from({ length: 12 }, (_, i) => ({ titel: `T${i}`, adress: `https://a.se/${i}` })),
  });
  assert.equal(kallor.length, 8);
});

test('kallorUr ger tom lista pa trasig eller tom kropp', () => {
  assert.deepEqual(kallorUr({}), []);
  assert.deepEqual(kallorUr({ kallor: 'nej' }), []);
  assert.deepEqual(kallorUr({ kallor: [null, 7, 'x', {}] }), []);
  assert.deepEqual(kallorUr({ kallor: [{ titel: 'Utan adress' }] }), []);
});

test('domanUr tar bort www, port och versaler', () => {
  assert.equal(domanUr('https://WWW.Exempel.SE:8443/sida'), 'exempel.se');
  assert.equal(domanUr('http://a.b.c/x'), 'a.b.c');
  assert.equal(domanUr('inte en adress'), '');
});

/**
 * 429 har två betydelser (direktiv 30), och bara kroppen skiljer dem.
 *
 * Läses den fel får användaren "dagens frågor är slut" för ett tak som
 * släpper om tio sekunder — eller tvärtom en väntan på en minut när kvoten
 * i själva verket är slut till midnatt.
 */
test('las429: minuttaket känns igen på typ och bär sina sekunder', () => {
  const svar = las429(JSON.stringify({ sort: 'fel', typ: 'rate_limited', retryAfter: 42 }));
  assert.deepEqual(svar, { sort: 'for-snabbt', retryAfter: 42 });
});

test('las429: dygnstaket ar standardtolkningen', () => {
  assert.deepEqual(las429(JSON.stringify({ nollstallsOm: 3600 })), {
    sort: 'slut',
    nollstallsOm: 3600,
  });
});

test('las429: en annan feltyp ar inte minuttaket', () => {
  assert.deepEqual(las429(JSON.stringify({ typ: 'overloaded', nollstallsOm: 10 })), {
    sort: 'slut',
    nollstallsOm: 10,
  });
});

test('las429: trasig, tom och icke-objektkropp ger dygnsbeskedet utan tid', () => {
  for (const kropp of ['{detta ar inte json', '', 'null', '"text"', '7']) {
    assert.deepEqual(las429(kropp), { sort: 'slut', nollstallsOm: 0 }, kropp);
  }
});

test('las429: tal som inte ar tal blir noll i stallet for NaN', () => {
  assert.deepEqual(las429(JSON.stringify({ typ: 'rate_limited', retryAfter: 'snart' })), {
    sort: 'for-snabbt',
    retryAfter: 0,
  });
  assert.deepEqual(las429(JSON.stringify({ typ: 'rate_limited' })), {
    sort: 'for-snabbt',
    retryAfter: 0,
  });
  assert.deepEqual(las429(JSON.stringify({ nollstallsOm: -5 })), {
    sort: 'slut',
    nollstallsOm: 0,
  });
});
