/**
 * Testerna för valet av resultatvy och för uppackningen av motorns svar.
 *
 * Resultaten kommer ur motorn på riktigt — testet räknar inte själv och
 * skriver inga svar för hand. Då kan ett test inte råka beskriva en form
 * motorn inte längre har.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  comparePrices,
  interest,
  margin,
  packages,
  splitCost,
  workTime,
} from '@techrabbit/engine';

import {
  arbetstid,
  delning,
  delningsbildensRader,
  forpackningar,
  jamforelse,
  valjVy,
} from '../lib/resultatvy.ts';

const JAMFOR = comparePrices([
  { pris: 49, mangd: 750, enhet: 'g' },
  { pris: 75, mangd: 1.2, enhet: 'kg' },
]);
const DELA = splitCost([{ betalat: 900 }, { betalat: 300 }, { betalat: 0 }]);
const PAKET = packages(23, 2.2, 'm²', { svinn: 10, forpackningsnamn: 'paket' });
const ARBETE = workTime([{ start: '07:30', slut: '16:15', rast: 30 }]);
const ARBETE_LON = workTime([{ start: '08:00', slut: '16:00', rast: 30 }], { timlon: 200 });

// ------------------------------------------------------------------- valet

test('valjVy kanner igen de fyra nya raknesatten', () => {
  assert.equal(valjVy(JAMFOR), 'jamforpris');
  assert.equal(valjVy(DELA), 'dela');
  assert.equal(valjVy(PAKET), 'forpackningar');
  assert.equal(valjVy(ARBETE), 'arbetstid');
  assert.equal(valjVy(ARBETE_LON), 'arbetstid');
});

test('valjVy lamnar ovriga raknesatt i standardvyn', () => {
  assert.equal(valjVy(margin(40, 65)), 'standard');
  assert.equal(valjVy(interest(200000, 3.5, 1)), 'standard');
  // Ett resultat utan fakta kan inte veta nagot: da galler vy 05.
  assert.equal(valjVy({ ...JAMFOR, fakta: [] }), 'standard');
});

test('valjVy behover bada nycklarna for jamforpris', () => {
  const utanSkillnad = {
    ...JAMFOR,
    fakta: (JAMFOR.fakta ?? []).filter((f) => f.nyckel !== 'skillnad'),
  };
  assert.notEqual(valjVy(utanSkillnad), 'jamforpris');
});

// -------------------------------------------------------------------- vy 30

test('jamforelse delar upp varorna och markerar den billigaste', () => {
  const j = jamforelse(JAMFOR);
  assert.ok(j !== null);
  assert.equal(j.varor.length, 2);
  assert.equal(j.varor[0]?.namn, 'A');
  assert.match(j.varor[0]?.beskrivning ?? '', /750/u);
  assert.equal(j.varor[0]?.billigast, false);
  assert.equal(j.varor[1]?.namn, 'B');
  assert.equal(j.varor[1]?.varde, '62,50');
  assert.equal(j.varor[1]?.enhet, 'kr/kg');
  assert.equal(j.varor[1]?.billigast, true);
  assert.equal(j.skillnad, '2,83');
  assert.equal(j.procent, '4,3');
  assert.match(j.rad, /billigare per kg/u);
});

test('jamforelse ger null for ett resultat utan rader', () => {
  assert.equal(jamforelse(margin(40, 65)), null);
});

// -------------------------------------------------------------------- vy 31

test('delning skiljer personer fran overforingar', () => {
  const d = delning(DELA);
  assert.ok(d !== null);
  assert.deepEqual(d.personer.map((p) => p.namn), ['A', 'B', 'C']);
  assert.equal(d.personer[0]?.betalat, '900,00 kr');
  assert.equal(d.personer[0]?.skaBara, '400,00');
  assert.equal(d.perPerson, '400,00');
  assert.equal(d.overforingar.length, 2);
  assert.deepEqual(d.overforingar[0], {
    fran: 'C',
    till: 'A',
    belopp: '400,00',
    enhet: 'kr',
  });
  assert.equal(d.totalt, '1 200,00');
});

test('delning utan utlagg ger personer men inga overforingar', () => {
  const d = delning(splitCost([], 4, { total: 1000 }));
  assert.ok(d !== null);
  assert.equal(d.overforingar.length, 0);
  assert.equal(d.personer.length, 4);
  assert.equal(d.personer[0]?.betalat, '');
  assert.equal(d.perPerson, '250,00');
});

// -------------------------------------------------------------------- vy 32

test('forpackningar ger behov, svinn, overskott och andelar', () => {
  const f = forpackningar(PAKET);
  assert.ok(f !== null);
  assert.equal(f.antal, '12');
  assert.equal(f.namn, 'paket');
  assert.equal(f.behov.varde, '23,0');
  assert.equal(f.svinn?.etikett, 'Svinn 10 %');
  assert.equal(f.overskott.varde, '1,1');
  // 23 + 2,3 + 1,1 = 26,4 m², den kopta mangden.
  assert.equal(f.totalt, '26,4');
  assert.equal(f.enhet, 'm²');
  const summa = f.behov.andel + (f.svinn?.andel ?? 0) + f.overskott.andel;
  assert.ok(Math.abs(summa - 1) < 1e-9, String(summa));
  assert.match(f.skal, /avrundas uppåt/u);
});

test('forpackningar utan svinn har ingen svinndel', () => {
  const f = forpackningar(packages(10, 2, 'st'));
  assert.ok(f !== null);
  assert.equal(f.svinn, null);
  assert.equal(f.antal, '5');
});

// -------------------------------------------------------------------- vy 33

test('arbetstid laser start, slut och rast ur stegen', () => {
  const a = arbetstid(ARBETE);
  assert.ok(a !== null);
  assert.equal(a.total, '8 h 15 min');
  assert.equal(a.pass.length, 1);
  assert.deepEqual(a.pass[0], {
    namn: 'Arbetad tid',
    start: '07:30',
    slut: '16:15',
    rast: '30',
    tid: '8 h 15 min',
  });
  assert.equal(a.lon, null);
});

test('arbetstid med timlon bar bade tiden och lonen', () => {
  const a = arbetstid(ARBETE_LON);
  assert.ok(a !== null);
  assert.equal(a.total, '7 h 30 min');
  assert.equal(a.lon, '1 500,00');
  assert.equal(a.lonEnhet, 'kr');
  assert.equal(a.timlon, '200,00');
});

test('arbetstid tar flera pass', () => {
  const a = arbetstid(
    workTime([
      { start: '08:00', slut: '12:00' },
      { start: '13:00', slut: '17:30' },
    ]),
  );
  assert.ok(a !== null);
  assert.equal(a.pass.length, 2);
  assert.equal(a.pass[1]?.start, '13:00');
  assert.equal(a.pass[1]?.rast, '');
  assert.equal(a.total, '8 h 30 min');
});

test('arbetstid ger null for ett annat raknesatt', () => {
  assert.equal(arbetstid(margin(40, 65)), null);
});

// -------------------------------------------- direktiv 24: huvudsvar och bild

test('arbetstid sager vilket tal som ar huvudsvaret', () => {
  const tid = arbetstid(
    workTime([{ start: '08:00', slut: '16:00', rast: 30 }], { timlon: 200, huvudsvar: 'tid' }),
  );
  assert.equal(tid?.huvudsvar, 'tid');
  assert.equal(tid?.total, '7 h 30 min');
  assert.equal(tid?.lon, '1 500,00');

  const lon = arbetstid(
    workTime([{ start: '08:00', slut: '16:00', rast: 30 }], { timlon: 200, huvudsvar: 'lon' }),
  );
  assert.equal(lon?.huvudsvar, 'lon');
  assert.equal(lon?.total, '7 h 30 min');
  assert.equal(lon?.lon, '1 500,00');
});

test('delningsbildensRader ger overforingarna, och inget for andra raknesatt', () => {
  const rader = delningsbildensRader(DELA);
  assert.deepEqual(rader, [
    { etikett: 'C → A betalar', varde: '400,00 kr' },
    { etikett: 'B → A betalar', varde: '100,00 kr' },
  ]);
  assert.deepEqual(delningsbildensRader(PAKET), []);
  assert.deepEqual(delningsbildensRader(ARBETE), []);
});
