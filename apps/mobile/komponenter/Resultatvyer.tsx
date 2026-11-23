/**
 * Resultatvyerna 30–33 i design v4.
 *
 * KOMPONENTER.md, "Resultatvyer (samma ark och grönt svar som 05)":
 *
 * | 30 Jämförpris  | lägsta pris per kg, 48/900 | två kort sida vid sida, radie 18. Det
 *                    billigaste har kant 2 greenIcon, märket "Billigast per kg" och priset
 *                    i greenText. Under korten en rad om skillnaden. |
 * | 31 Dela        | antal överföringar | personkort med Betalat och Ska bära, och
 *                    överföringsrader "C → A betalar 400 kr" med pil och belopp i
 *                    greenText, kant 1,5 greenEdge |
 * | 32 Förpackningar | antal paket | stapel 22 hög: behov (greenIcon), spill (greenIcon
 *                      45 %), överskott (randigt border), plus förklaring |
 * | 33 Arbetstid   | arbetad tid | tidslinje: linje 6 pt greenIcon, randigt rastfält,
 *                    punkter för start och slut, tider 17/700 under |
 *
 * `greenEdge` finns i tokens.json sedan direktiv 24: en grön kant med låg
 * täckning, så att den syns mot både card och bg i båda temana. Värdet är
 * satt av oss — designunderlaget namnger färgen men ger inget värde.
 *
 * RORELSE-HAPTIK.md har ingen egen rad för 30–33. "Samma ark som 05" gäller
 * alltså: sheeten glider upp på 280 ms och innehållet tonas in, vilket
 * ResultatSheet redan sköter. Inga egna rörelser är påhittade här.
 *
 * Huvudsvaret är grönt som i 05, och varje block bär en VoiceOver-etikett —
 * en stapel och en tidslinje säger ingenting för den som inte ser dem.
 */

import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

import type { Resultat } from '@techrabbit/engine';

import { useTema } from '../design/tema';
import { TEXT } from '../design/tokens';
import {
  arbetstid,
  delning,
  forpackningar,
  jamforelse,
  type Vysort,
} from '../lib/resultatvy';

/** Stapelns höjd i vy 32, enligt KOMPONENTER.md. */
const STAPEL = 22;
/** Tidslinjens tjocklek i vy 33. */
const LINJE = 6;

export interface VardagsresultatProps {
  readonly sort: Exclude<Vysort, 'standard'>;
  readonly resultat: Resultat;
  /** Etiketten över talet, t.ex. "Billigast är B". */
  readonly etikett: string;
}

/**
 * Resultatkortet för en av vyerna 30–33.
 *
 * Returnerar null när svaret inte går att packa upp — då visar
 * ResultatSheet vy 05 i stället. Hellre det vanliga kortet än ett halvt.
 */
export function Vardagsresultat({ sort, resultat, etikett }: VardagsresultatProps): ReactNode {
  if (sort === 'jamforpris') return <Jamforpris resultat={resultat} etikett={etikett} />;
  if (sort === 'dela') return <Delakostnader resultat={resultat} etikett={etikett} />;
  if (sort === 'forpackningar') return <Forpackningar resultat={resultat} etikett={etikett} />;
  return <Arbetstid resultat={resultat} etikett={etikett} />;
}

/**
 * Huvudsvaret: etiketten, talet 48/900 i `greenAnswer` och enheten.
 *
 * `greenAnswer` är klargrönt i båda temana (direktiv 27). Övrig grön text i
 * vyerna — jämförpriset, överföringsbeloppet, lönen — följer `greenText` som
 * förut: de är inte huvudsvaret.
 */
function Huvudsvar({
  etikett,
  tal,
  enhet,
}: {
  readonly etikett: string;
  readonly tal: string;
  readonly enhet: string;
}): ReactNode {
  const { farg } = useTema();
  return (
    <View accessible accessibilityLabel={`${etikett}. ${tal} ${enhet}`}>
      <Text
        maxFontSizeMultiplier={1.6}
        style={[TEXT['body'], styles.etikett, { color: farg['muted'] }]}
      >
        {etikett}
      </Text>
      <View style={styles.talrad}>
        <Text maxFontSizeMultiplier={1.4} style={[styles.tal, { color: farg['greenAnswer'] }]}>
          {tal}
        </Text>
        {enhet === '' ? null : (
          <Text
            maxFontSizeMultiplier={1.4}
            style={[TEXT['resultUnit'], { color: farg['greenAnswer'] }]}
          >
            {enhet}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Versal avdelarrubrik, t.ex. "PERSONER · TOTALT 1 200 KR". */
function Avdelare({ text }: { readonly text: string }): ReactNode {
  const { farg } = useTema();
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      style={[TEXT['sectionLabel'], styles.versal, { color: farg['muted'] }]}
    >
      {text}
    </Text>
  );
}

/**
 * Randigt fält: snedställda ränder, som i designen (direktiv 24).
 *
 * Ränderna ritas med react-native-svg, som redan finns i bygget: ett
 * `Pattern` med en diagonal linje, upprepat över ytan. Mönstret roteras i
 * patternTransform, inte vyn — en roterad vy hade krävt klippning och en
 * extra nivå i trädet.
 *
 * Bredden mäts med onLayout, eftersom fältet ofta är ett flex-barn och inte
 * vet sin bredd i förväg. Före första mätningen ritas ingenting: en stapel
 * som hoppar en bildruta är värre än en som kommer en bildruta sent.
 */
function Randigt({
  hojd,
  farg,
  etikett,
  id,
}: {
  readonly hojd: number;
  readonly farg: string;
  readonly etikett?: string;
  /** Unikt namn på mönstret. Två Svg med samma id delar definition. */
  readonly id: string;
}): ReactNode {
  const [bredd, setBredd] = useState(0);
  const matt = (e: LayoutChangeEvent): void => {
    const ny = Math.round(e.nativeEvent.layout.width);
    if (ny !== bredd) setBredd(ny);
  };

  return (
    <View
      onLayout={matt}
      {...(etikett === undefined ? {} : { accessible: true, accessibilityLabel: etikett })}
      style={{ height: hojd, width: '100%', overflow: 'hidden' }}
    >
      {bredd <= 0 ? null : (
        <Svg width={bredd} height={hojd}>
          <Defs>
            {/* Rutan är 8 × 8 med en 2,5 pt linje, vriden 45 grader. */}
            <Pattern
              id={id}
              patternUnits="userSpaceOnUse"
              width={8}
              height={8}
              patternTransform="rotate(45)"
            >
              <Line x1={2} y1={0} x2={2} y2={8} stroke={farg} strokeWidth={2.5} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={bredd} height={hojd} fill={`url(#${id})`} />
        </Svg>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Vy 30
// ---------------------------------------------------------------------------

function Jamforpris({
  resultat,
  etikett,
}: {
  readonly resultat: Resultat;
  readonly etikett: string;
}): ReactNode {
  const { farg } = useTema();
  const j = jamforelse(resultat);
  if (j === null) return null;
  const enhetsnamn = resultat.unit.split('/')[1] ?? '';

  return (
    <View style={[styles.kort, { backgroundColor: farg['card'] }]}>
      <Huvudsvar etikett={etikett} tal={resultat.formatted} enhet={resultat.unit} />

      <View style={styles.varor}>
        {j.varor.map((v) => (
          <View
            key={v.namn + v.beskrivning}
            accessible
            accessibilityLabel={
              `${v.namn}. ${v.beskrivning}. ${v.varde} ${v.enhet}.` +
              (v.billigast ? ` Billigast per ${enhetsnamn}.` : '')
            }
            style={[
              styles.varukort,
              {
                backgroundColor: farg['bg'],
                borderColor: v.billigast ? farg['greenIcon'] : farg['border'],
                borderWidth: v.billigast ? 2 : StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Text maxFontSizeMultiplier={1.4} style={[styles.varunamn, { color: farg['muted'] }]}>
              {v.namn}
            </Text>
            <Text
              maxFontSizeMultiplier={1.5}
              style={[styles.varurad, { color: farg['text'] }]}
            >
              {v.beskrivning}
            </Text>
            <View style={styles.varupris}>
              <Text
                maxFontSizeMultiplier={1.4}
                style={[
                  styles.varuvarde,
                  { color: v.billigast ? farg['greenText'] : farg['text'] },
                ]}
              >
                {v.varde}
              </Text>
              <Text maxFontSizeMultiplier={1.3} style={[TEXT['meta'], { color: farg['muted'] }]}>
                {v.enhet}
              </Text>
            </View>
            {v.billigast ? (
              <View style={[styles.marke, { backgroundColor: farg['greenSoft'] }]}>
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={[styles.marketext, { color: farg['onGreenSoft'] }]}
                >
                  {`Billigast per ${enhetsnamn}`}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {j.rad === '' ? null : (
        <Text
          maxFontSizeMultiplier={1.6}
          style={[TEXT['secondary'], styles.underrad, { color: farg['muted'] }]}
        >
          {j.rad}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Vy 31
// ---------------------------------------------------------------------------

function Delakostnader({
  resultat,
  etikett,
}: {
  readonly resultat: Resultat;
  readonly etikett: string;
}): ReactNode {
  const { farg } = useTema();
  const d = delning(resultat);
  if (d === null) return null;
  const antal = d.overforingar.length;

  return (
    <View style={[styles.kort, { backgroundColor: farg['card'] }]}>
      {/*
        KOMPONENTER.md: huvudsvaret i 31 är ANTALET överföringar, inte
        beloppet. Beloppet står i personkorten som "Ska bära". Finns inga
        överföringar — alla har betalat lika, eller frågan gav bara en
        totalsumma — vore "0 överföringar" ett tomt svar, och då är beloppet
        per person huvudsvaret i stället.
      */}
      {antal > 0 ? (
        <Huvudsvar
          etikett={etikett}
          tal={String(antal)}
          enhet={antal === 1 ? 'överföring' : 'överföringar'}
        />
      ) : (
        <Huvudsvar etikett={etikett} tal={d.perPerson} enhet={d.enhet} />
      )}

      <Avdelare
        text={d.totalt === '' ? 'Personer' : `Personer · totalt ${d.totalt} ${d.enhet}`}
      />

      <View style={styles.personer}>
        {d.personer.map((p) => (
          <View
            key={p.namn}
            accessible
            accessibilityLabel={
              `${p.namn}.` +
              (p.betalat === '' ? '' : ` Betalat ${p.betalat}.`) +
              ` Ska bära ${p.skaBara} ${p.enhet}.`
            }
            style={[styles.personkort, { backgroundColor: farg['bg'], borderColor: farg['border'] }]}
          >
            <Text maxFontSizeMultiplier={1.4} style={[styles.personnamn, { color: farg['text'] }]}>
              {p.namn}
            </Text>
            <View style={styles.fyll}>
              {p.betalat === '' ? null : (
                <Text
                  maxFontSizeMultiplier={1.4}
                  style={[TEXT['meta'], { color: farg['muted'] }]}
                >
                  {`Betalat ${p.betalat}`}
                </Text>
              )}
              <Text
                maxFontSizeMultiplier={1.4}
                style={[styles.personvarde, { color: farg['text'] }]}
              >
                {`Ska bära ${p.skaBara} ${p.enhet}`}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {antal === 0 ? null : (
        <>
          <Avdelare text={antal === 1 ? 'Överföring' : 'Överföringar'} />
          <View style={styles.personer}>
            {d.overforingar.map((o) => (
              <View
                key={`${o.fran}-${o.till}-${o.belopp}`}
                accessible
                accessibilityLabel={`${o.fran} betalar ${o.till} ${o.belopp} ${o.enhet}`}
                style={[
                  styles.overforing,
                  { backgroundColor: farg['bg'], borderColor: farg['greenEdge'] },
                ]}
              >
                <Text
                  maxFontSizeMultiplier={1.4}
                  style={[styles.personnamn, { color: farg['text'] }]}
                >
                  {`${o.fran} → ${o.till}`}
                </Text>
                <Text
                  maxFontSizeMultiplier={1.4}
                  style={[styles.overforingsbelopp, { color: farg['greenText'] }]}
                >
                  {`${o.belopp} ${o.enhet}`}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Vy 32
// ---------------------------------------------------------------------------

function Forpackningar({
  resultat,
  etikett,
}: {
  readonly resultat: Resultat;
  readonly etikett: string;
}): ReactNode {
  const { farg } = useTema();
  const f = forpackningar(resultat);
  if (f === null) return null;
  const gron = farg['greenIcon'] ?? '#1ED63C';
  const delar = [f.behov, ...(f.svinn === null ? [] : [f.svinn]), f.overskott];

  return (
    <View style={[styles.kort, { backgroundColor: farg['card'] }]}>
      <Huvudsvar etikett={etikett} tal={f.antal} enhet={f.namn} />

      <Avdelare
        text={`Fördelning · ${f.antal} ${f.namn} = ${f.totalt} ${f.enhet}`}
      />

      {/* Stapeln: behov fyllt, svinn halvgenomskinligt, överskott randigt. */}
      <View
        accessible
        accessibilityLabel={delar
          .map((d) => `${d.etikett} ${d.varde} ${d.enhet}`)
          .join('. ')}
        style={[styles.stapel, { backgroundColor: farg['track'] }]}
      >
        <View style={{ flex: Math.max(0.001, f.behov.andel), backgroundColor: gron }} />
        {f.svinn === null ? null : (
          <View
            style={{ flex: Math.max(0.001, f.svinn.andel), backgroundColor: gron, opacity: 0.45 }}
          />
        )}
        <View style={{ flex: Math.max(0.001, f.overskott.andel) }}>
          <Randigt id="overskott" hojd={STAPEL} farg={farg['border'] ?? '#CCC'} />
        </View>
      </View>

      <View style={styles.rader}>
        {delar.map((d, i) => (
          <View
            key={d.etikett}
            style={[
              styles.rad,
              i === 0
                ? null
                : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: farg['border'] },
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.5}
              style={[TEXT['rowTitle'], styles.fyll, { color: farg['muted'] }]}
            >
              {d.etikett}
            </Text>
            <Text maxFontSizeMultiplier={1.4} style={[styles.radvarde, { color: farg['text'] }]}>
              {`${d.varde} ${d.enhet}`}
            </Text>
          </View>
        ))}
      </View>

      {f.skal === '' ? null : (
        <Text
          maxFontSizeMultiplier={1.6}
          style={[TEXT['secondary'], styles.underrad, { color: farg['muted'] }]}
        >
          {f.skal}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Vy 33
// ---------------------------------------------------------------------------

function Arbetstid({
  resultat,
  etikett,
}: {
  readonly resultat: Resultat;
  readonly etikett: string;
}): ReactNode {
  const { farg } = useTema();
  const a = arbetstid(resultat);
  if (a === null) return null;
  const gron = farg['greenIcon'] ?? '#1ED63C';

  return (
    <View style={[styles.kort, { backgroundColor: farg['card'] }]}>
      {/*
        Huvudsvaret följer frågan (direktiv 24): "hur länge" ger tiden, "vad
        tjänar jag" ger lönen. Motorn har redan valt, och det andra talet
        står som en rad under tidslinjen.
      */}
      {a.huvudsvar === 'lon' && a.lon !== null ? (
        <Huvudsvar etikett={etikett} tal={a.lon} enhet={a.lonEnhet} />
      ) : (
        <Huvudsvar etikett={a.lon === null ? etikett : 'Arbetad tid'} tal={a.total} enhet="" />
      )}

      <Avdelare text="Tidslinje" />

      {a.pass.map((p) => (
        <View
          key={`${p.namn}-${p.start}`}
          accessible
          accessibilityLabel={
            `${p.namn}. Började ${p.start}, slutade ${p.slut}.` +
            (p.rast === '' ? '' : ` Rast ${p.rast} minuter.`) +
            ` ${p.tid}.`
          }
          style={styles.pass}
        >
          {a.pass.length > 1 ? (
            <Text maxFontSizeMultiplier={1.4} style={[TEXT['meta'], { color: farg['muted'] }]}>
              {`${p.namn} · ${p.tid}`}
            </Text>
          ) : null}
          <View style={styles.linjerad}>
            <View style={[styles.punkt, { backgroundColor: gron }]} />
            <View style={[styles.linje, { backgroundColor: gron }]} />
            {p.rast === '' ? null : (
              <View style={styles.rastfalt}>
                <Randigt id="rast" hojd={LINJE} farg={farg['faint'] ?? '#8A8A8A'} />
              </View>
            )}
            <View style={[styles.linje, { backgroundColor: gron }]} />
            <View style={[styles.punkt, { backgroundColor: gron }]} />
          </View>
          <View style={styles.tider}>
            <Text maxFontSizeMultiplier={1.4} style={[styles.tid, { color: farg['text'] }]}>
              {p.start}
            </Text>
            {p.rast === '' ? null : (
              <Text maxFontSizeMultiplier={1.3} style={[TEXT['meta'], { color: farg['muted'] }]}>
                {`Rast ${p.rast} min`}
              </Text>
            )}
            <Text maxFontSizeMultiplier={1.4} style={[styles.tid, { color: farg['text'] }]}>
              {p.slut}
            </Text>
          </View>
        </View>
      ))}

      {a.lon === null ? null : (
        <View style={[styles.rader, { borderTopColor: farg['border'] }]}>
          <View
            accessible
            accessibilityLabel={
              a.huvudsvar === 'lon'
                ? `Arbetad tid ${a.total}`
                : `Lön ${a.lon} ${a.lonEnhet}` +
                  (a.timlon === null ? '' : `, ${a.timlon} per timme`)
            }
            style={styles.rad}
          >
            <Text
              maxFontSizeMultiplier={1.5}
              style={[TEXT['rowTitle'], styles.fyll, { color: farg['muted'] }]}
            >
              {a.huvudsvar === 'lon'
                ? 'Arbetad tid'
                : a.timlon === null
                  ? 'Lön'
                  : `Lön · ${a.timlon} ${a.lonEnhet}/h`}
            </Text>
            <Text
              maxFontSizeMultiplier={1.4}
              style={[styles.radvarde, { color: farg['greenText'] }]}
            >
              {a.huvudsvar === 'lon' ? a.total : `${a.lon} ${a.lonEnhet}`}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fyll: { flex: 1 },
  kort: { borderRadius: 20, padding: 18, gap: 12 },
  etikett: { marginBottom: 2 },
  talrad: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  // 48/900 enligt KOMPONENTER.md, med samma negativa spärr som vy 05.
  tal: { fontSize: 48, lineHeight: 54, fontFamily: 'Archivo_900Black', letterSpacing: -1.6, includeFontPadding: false },
  versal: { textTransform: 'uppercase', letterSpacing: 0.6 },
  underrad: { marginTop: 2 },

  // Vy 30
  varor: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  varukort: { flexGrow: 1, flexBasis: 130, borderRadius: 18, padding: 14, gap: 4 },
  varunamn: { fontSize: 13, fontFamily: 'Archivo_800ExtraBold', letterSpacing: 0.6 },
  varurad: { fontSize: 13, lineHeight: 17, fontFamily: 'Archivo_500Medium' },
  varupris: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 2 },
  varuvarde: { fontSize: 22, lineHeight: 26, fontFamily: 'Archivo_900Black', includeFontPadding: false },
  marke: { alignSelf: 'flex-start', borderRadius: 13, paddingHorizontal: 9, paddingVertical: 3, marginTop: 4 },
  marketext: { fontSize: 12, fontFamily: 'Archivo_800ExtraBold' },

  // Vy 31
  personer: { gap: 8 },
  personkort: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  personnamn: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold' },
  personvarde: { fontSize: 15, fontFamily: 'Archivo_700Bold' },
  overforing: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  overforingsbelopp: { fontSize: 17, fontFamily: 'Archivo_900Black', includeFontPadding: false },

  // Vy 32
  stapel: { height: STAPEL, borderRadius: STAPEL / 2, overflow: 'hidden', flexDirection: 'row' },
  // Rastfältet är lika brett som en dryg halvtimme känns: 54 pt, som i vyn.
  rastfalt: { width: 54 },
  rader: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'transparent' },
  rad: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  radvarde: { fontSize: 17, fontFamily: 'Archivo_800ExtraBold', includeFontPadding: false },

  // Vy 33
  pass: { gap: 8 },
  linjerad: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 16 },
  linje: { flex: 1, height: LINJE, borderRadius: LINJE / 2 },
  punkt: { width: 12, height: 12, borderRadius: 6 },
  tider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tid: { fontSize: 17, fontFamily: 'Archivo_700Bold', includeFontPadding: false },
});
