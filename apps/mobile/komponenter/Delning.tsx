/**
 * Dela: delningskortet och delningsvyn (vy 10 i design v2).
 *
 * KOMPONENTER.md: radie 22, padding 22, grön cirkel i hörnet med låg
 * opacitet, etikett 13/700, tal 46/50 900, enhet 18/800, villkor 13/18,
 * avsändare 12/800 versaler. Kortet har ALLTID mörk botten, också i ljust
 * läge: bilden ska se likadan ut vart den än skickas.
 *
 * Färgerna i kortet är skrivna som fasta värden i stället för tokens, just
 * därför: kortet följer inte telefonens tema. Den gröna accenten är den enda
 * färg som tas ur temat, så att bilden följer appens gröna.
 *
 * Inget ljud, ingen fråga och ingen bild skickas till vår server. Bilden
 * fångas på telefonen och lämnas till telefonens egen delningsmeny.
 */

import { useRef, useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, Switch, Text, View, type ViewInstance } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTema } from '../design/tema';
import { TEXT } from '../design/tokens';
import { delaVy, delningFinns } from '../lib/dela';
import { useHaptik } from '../lib/rorelse';

import { PrimarKnapp } from './Knapp';
import { Sheet } from './Sheet';

/** Kortets egna färger. Se filhuvudet: bilden följer inte telefonens tema. */
const BOTTEN = '#0B0B0B';
const LJUS = '#F2F2F2';
/**
 * Huvudsvarets grönt.
 *
 * Samma token som skärmen använder: `greenAnswer` är #1CF038 i båda temana
 * (direktiv 27), vilket också är det gröna som hör till kortets mörka botten.
 * Reservvärdet står här bara för den händelse att temat inte svarar.
 */
const GRON_TEXT_RESERV = '#1CF038';
const DAMPAD = '#A8A8A8';
const SVAG = '#8A8A8A';
const LINJE = '#2E2E2E';

export interface Delningsinnehall {
  readonly fraga: string;
  readonly etikett: string;
  readonly varde: string;
  readonly enhet: string;
  readonly villkor: readonly string[];
  /**
   * Rader under talet, t.ex. överföringarna i vy 31 (direktiv 24).
   * Bilden ska bära samma svar som skärmen — ett delat notasvar utan "vem
   * betalar vem" är inte till någon hjälp i en chatt.
   */
  readonly rader?: readonly { readonly etikett: string; readonly varde: string }[];
}

/**
 * Själva bilden. Ritas i vyn och fångas som PNG — det är samma pixlar som
 * användaren ser i förhandsgranskningen.
 */
export function Delningskort({
  innehall,
  medFraga,
  vyref,
}: {
  readonly innehall: Delningsinnehall;
  readonly medFraga: boolean;
  readonly vyref?: Ref<ViewInstance>;
}): ReactNode {
  const { farg } = useTema();
  const gron = farg['greenIcon'] ?? '#1DB954';
  const svarsgront = farg['greenAnswer'] ?? GRON_TEXT_RESERV;

  /*
    Texten i kortet skalar INTE med Dynamic Type.

    Kortet är en bild med fasta mått: vid 310 % textstorlek skulle talet
    svämma över kanten och bilden bli oläslig för alla som ser den. Den som
    behöver större text läser svaret i resultatvyn, som skalar. Därför
    maxFontSizeMultiplier={1} på varje rad här (direktiv 23).
  */
  return (
    <View ref={vyref} collapsable={false} style={[styles.kort, { backgroundColor: BOTTEN }]}>
      {/* Den gröna cirkeln i hörnet. Svg i stället för CSS-gradient. */}
      <Svg style={styles.glod} width={220} height={220}>
        <Defs>
          <RadialGradient id="delaglod" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={gron} stopOpacity={0.22} />
            <Stop offset="0.68" stopColor={gron} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={220} height={220} fill="url(#delaglod)" />
      </Svg>

      {medFraga ? (
        <Text numberOfLines={3} maxFontSizeMultiplier={1} style={[styles.fraga, { color: DAMPAD }]}>
          {innehall.fraga}
        </Text>
      ) : null}

      <Text maxFontSizeMultiplier={1} style={[styles.etikett, { color: DAMPAD }]}>{innehall.etikett}</Text>
      <View style={styles.talrad}>
        <Text maxFontSizeMultiplier={1} style={[styles.tal, { color: svarsgront }]}>{innehall.varde}</Text>
        <Text maxFontSizeMultiplier={1} style={[styles.enhet, { color: svarsgront }]}>{innehall.enhet}</Text>
      </View>
      {innehall.villkor.length > 0 ? (
        <Text maxFontSizeMultiplier={1} style={[styles.villkor, { color: SVAG }]}>{innehall.villkor.join(' · ')}</Text>
      ) : null}

      {/* Raderna: högst fyra, annars växer bilden ur sitt format. */}
      {(innehall.rader ?? []).slice(0, 4).map((r) => (
        <View key={r.etikett} style={styles.delrad}>
          <Text maxFontSizeMultiplier={1} numberOfLines={1} style={[styles.delradtext, { color: DAMPAD }]}>
            {r.etikett}
          </Text>
          <Text maxFontSizeMultiplier={1} style={[styles.delradvarde, { color: LJUS }]}>
            {r.varde}
          </Text>
        </View>
      ))}

      <View style={[styles.linje, { backgroundColor: LINJE }]} />
      <View style={styles.fot}>
        <Text maxFontSizeMultiplier={1} style={[styles.avsandare, { color: gron }]}>TECH RABBIT CALC</Text>
        <Text maxFontSizeMultiplier={1} style={[styles.slagord, { color: SVAG }]}>Räknat, inte gissat</Text>
      </View>
    </View>
  );
}

export interface DelaSheetProps {
  readonly oppen: boolean;
  readonly innehall: Delningsinnehall;
  readonly onStang: () => void;
}

/** Vy 10: förhandsgranskningen, växeln för frågan och knappen Dela. */
export function DelaSheet({ oppen, innehall, onStang }: DelaSheetProps): ReactNode {
  const { farg } = useTema();
  const haptik = useHaptik();
  const kortet = useRef<ViewInstance>(null);
  /**
   * Frågan är med som standard. Designbilden visar växeln avslagen, men
   * direktivet säger att bilden ska bära frågan, och ett svar utan sin fråga
   * säger inte mycket i ett chattfönster.
   */
  const [medFraga, setMedFraga] = useState(true);
  const [delar, setDelar] = useState(false);
  const finns = delningFinns();

  async function dela(): Promise<void> {
    haptik('latt');
    setDelar(true);
    try {
      await delaVy(kortet.current);
    } finally {
      setDelar(false);
    }
  }

  return (
    <Sheet
      oppen={oppen}
      titel="Dela"
      onStang={onStang}
      fot={
        <PrimarKnapp
          titel="Dela"
          laddar={delar}
          laddarText="Förbereder bilden …"
          inaktiv={!finns}
          onPress={() => void dela()}
        />
      }
    >
      <Text maxFontSizeMultiplier={1.6} style={[TEXT['secondary'], { color: farg['muted'] }]}>
        {finns
          ? 'Så här ser bilden ut. Den skapas på telefonen och skickas ingenstans förrän du väljer vart.'
          : 'Delning fungerar i testappen. I Expo Go finns inte modulen som fångar bilden.'}
      </Text>

      <Delningskort innehall={innehall} medFraga={medFraga} vyref={kortet} />

      <View style={[styles.vaxelrad, { backgroundColor: farg['card'] }]}>
        <View style={styles.fyll}>
          <Text maxFontSizeMultiplier={1.5} style={[TEXT['rowTitle'], { color: farg['text'] }]}>
            Ta med min fråga
          </Text>
          <Text maxFontSizeMultiplier={1.5} style={[TEXT['secondary'], { color: farg['muted'] }]}>
            Frågan syns då i bilden.
          </Text>
        </View>
        <Switch
          value={medFraga}
          onValueChange={(v) => {
            haptik('latt');
            setMedFraga(v);
          }}
          accessibilityLabel="Ta med min fråga i bilden"
          trackColor={{ true: farg['greenIcon'] ?? '#1DB954', false: farg['track'] ?? '#DDD' }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fyll: { flex: 1 },
  kort: { borderRadius: 22, padding: 22, overflow: 'hidden' },
  glod: { position: 'absolute', right: -60, top: -70 },
  fraga: { fontSize: 13, lineHeight: 18, fontFamily: 'Archivo_500Medium', marginBottom: 14 },
  etikett: { fontSize: 13, lineHeight: 17, fontFamily: 'Archivo_700Bold' },
  talrad: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 4 },
  tal: {
    fontSize: 46,
    lineHeight: 50,
    fontFamily: 'Archivo_900Black',
    letterSpacing: -1.8,
    includeFontPadding: false,
  },
  enhet: { fontSize: 18, lineHeight: 22, fontFamily: 'Archivo_800ExtraBold' },
  villkor: { fontSize: 13, lineHeight: 18, fontFamily: 'Archivo_500Medium', marginTop: 5 },
  delrad: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 6,
  },
  delradtext: { fontSize: 13, lineHeight: 18, fontFamily: 'Archivo_500Medium', flexShrink: 1 },
  delradvarde: { fontSize: 14, lineHeight: 18, fontFamily: 'Archivo_800ExtraBold' },
  linje: { height: 1, marginTop: 16, marginBottom: 12 },
  fot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  avsandare: { fontSize: 12, lineHeight: 16, fontFamily: 'Archivo_800ExtraBold', letterSpacing: 0.8 },
  slagord: { fontSize: 12, lineHeight: 16, fontFamily: 'Archivo_500Medium' },

  vaxelrad: {
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
