/**
 * Korten: exempelkort, Din fråga-kort, resultatkort och stegrad.
 *
 * Mått ur KOMPONENTER.md. Resultatkortet byggs upp i ordning: siffran,
 * sedan förklaringen (+120 ms), sedan stegen ett i taget (+80 ms var)
 * — se RORELSE-HAPTIK.md, vy 05.
 */

import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTema } from '../design/tema';
import { SKARMMARGINAL, TEXT } from '../design/tokens';
import { REDUCERAD_MS, TRYCK_MS, useHaptik, useRorelse, YTA_MS } from '../lib/rorelse';

import { LoggaTechRabbitAI } from './Bilder';

// ---------------------------------------------------------------------------
// Exempelkort
// ---------------------------------------------------------------------------

export interface Exempel {
  readonly titel: string;
  readonly rad: string;
  /** Frågan som fylls i frågefältet vid tryck. */
  readonly fraga: string;
}

export function Exempelkort({
  exempel,
  onPress,
}: {
  readonly exempel: Exempel;
  readonly onPress: (fraga: string) => void;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const skala = useSharedValue(1);
  const animerad = useAnimatedStyle(() => ({ transform: [{ scale: skala.value }] }));

  return (
    <Animated.View style={[styles.exempelyta, animerad]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${exempel.titel}. ${exempel.rad}`}
        accessibilityHint="Fyller frågefältet med exemplet."
        onPressIn={() => {
          skala.value = withTiming(rorelse.tryckskala, { duration: TRYCK_MS });
        }}
        onPressOut={() => {
          skala.value = withTiming(1, { duration: TRYCK_MS });
        }}
        onPress={() => onPress(exempel.fraga)}
        style={[styles.exempel, { backgroundColor: farg['card'] }]}
      >
        <Text maxFontSizeMultiplier={1.6} style={[TEXT['rowTitle'], viktig, { color: farg['text'] }]}>
          {exempel.titel}
        </Text>
        <Text maxFontSizeMultiplier={1.6} style={[TEXT['secondary'], { color: farg['muted'] }]}>
          {exempel.rad}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Din fråga-kort
// ---------------------------------------------------------------------------

export function DinFragaKort({
  fraga,
  fallbart = true,
}: {
  readonly fraga: string;
  readonly fallbart?: boolean;
}): ReactNode {
  const { farg } = useTema();
  const [utfallt, setUtfallt] = useState(!fallbart);

  const innehall = (
    <>
      <View style={styles.fragehuvud}>
        <Text
          maxFontSizeMultiplier={1.6}
          style={[TEXT['sectionLabel'], styles.versal, { color: farg['muted'] }]}
        >
          Din fråga
        </Text>
        {fallbart ? <Chevron farg={farg['muted'] ?? '#000'} upp={utfallt} /> : null}
      </View>
      <Text
        numberOfLines={utfallt ? undefined : 2}
        maxFontSizeMultiplier={1.8}
        style={[TEXT['body'], { color: farg['text'] }]}
      >
        {fraga}
      </Text>
    </>
  );

  if (!fallbart) {
    return <View style={[styles.fragekort, { backgroundColor: farg['card'] }]}>{innehall}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Din fråga. ${fraga}`}
      accessibilityState={{ expanded: utfallt }}
      accessibilityHint={utfallt ? 'Fäller ihop frågan.' : 'Visar hela frågan.'}
      onPress={() => setUtfallt((v) => !v)}
      style={[styles.fragekort, { backgroundColor: farg['card'] }]}
    >
      {innehall}
    </Pressable>
  );
}

function Chevron({ farg, upp }: { readonly farg: string; readonly upp: boolean }): ReactNode {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d={upp ? 'M7 14.5L12 9.5L17 14.5' : 'M7 9.5L12 14.5L17 9.5'}
        stroke={farg}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Resultatkort
// ---------------------------------------------------------------------------

export function Resultatkort({
  etikett,
  varde,
  enhet,
  forklaring,
}: {
  readonly etikett: string;
  readonly varde: string;
  readonly enhet: string;
  readonly forklaring: string;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const tid = rorelse.reducerad ? REDUCERAD_MS : YTA_MS;

  return (
    <View
      style={[styles.resultat, { backgroundColor: farg['card'] }]}
      accessible
      accessibilityLabel={`${etikett}: ${varde} ${enhet}. ${forklaring}`}
    >
      <Animated.View entering={FadeIn.duration(tid)}>
        {/* Resultatkortets etikett: 14/700 enligt KOMPONENTER.md. */}
        <Text maxFontSizeMultiplier={1.6} style={[TEXT['body'], styles.resultatetikett, { color: farg['muted'] }]}>
          {etikett}
        </Text>
        <View style={styles.resultatrad}>
          <Text
            maxFontSizeMultiplier={1.4}
            style={[TEXT['result'], styles.resultatvarde, { color: farg['text'] }]}
          >
            {varde}
          </Text>
          <Text maxFontSizeMultiplier={1.4} style={[TEXT['resultUnit'], { color: farg['text'] }]}>
            {enhet}
          </Text>
        </View>
      </Animated.View>
      <Animated.View entering={FadeIn.duration(tid).delay(rorelse.reducerad ? 0 : 120)}>
        <Text
          maxFontSizeMultiplier={1.6}
          style={[TEXT['sectionLabel'], styles.versal, styles.forklaringsetikett, { color: farg['muted'] }]}
        >
          Förklaring
        </Text>
        <Text maxFontSizeMultiplier={1.8} style={[TEXT['body'], { color: farg['text'] }]}>
          {forklaring}
        </Text>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stegrad
// ---------------------------------------------------------------------------

export interface StegradProps {
  readonly nr: number;
  readonly uttryck: string;
  readonly resultat: string;
  readonly forst: boolean;
  /** Fördröjning innan raden tonas in, i ms. */
  readonly fordrojning: number;
}

export function Stegrad({ nr, uttryck, resultat, forst, fordrojning }: StegradProps): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const tid = rorelse.reducerad ? REDUCERAD_MS : YTA_MS;

  return (
    <Animated.View
      entering={FadeIn.duration(tid).delay(rorelse.reducerad ? 0 : fordrojning)}
      accessible
      accessibilityLabel={`Steg ${nr}. ${uttryck} ${resultat}`}
      style={[
        styles.steg,
        forst ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: farg['border'] },
      ]}
    >
      <View style={[styles.stegnummer, { backgroundColor: farg['inset'] }]}>
        <Text maxFontSizeMultiplier={1.3} style={[TEXT['meta'], { color: farg['text'] }]}>
          {nr}
        </Text>
      </View>
      <View style={styles.stegtext}>
        <Text maxFontSizeMultiplier={1.6} style={[TEXT['stepMath'], { color: farg['text'] }]}>
          {uttryck}
        </Text>
        <Text maxFontSizeMultiplier={1.6} style={[TEXT['secondary'], { color: farg['muted'] }]}>
          {resultat}
        </Text>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Premiumkort (vy 20)
// ---------------------------------------------------------------------------

/**
 * Kortet på Hem som öppnar Rabbit AI.
 *
 * KOMPONENTER.md v4: radie 22, padding 16/14, `card` med 1 pt grön kant,
 * märket GRATIS i `greenSoft`/`onGreenSoft` och länkraden i `greenText`.
 * Kanten är `greenEdge`, som lades till i tokens.json i direktiv 24.
 *
 * ## Direktiv 37
 *
 * Kaninsymbolen är utbytt mot TechRabbit AI-loggan, som ligger till vänster
 * i en egen spalt lika hög som kortets innehåll. Texten står till höger om
 * den. Loggan är liggande, 2,13 : 1: ritad lika hög som kortet hade den
 * blivit bredare än hela skärmen, så spalten är full höjd och bilden så stor
 * som ryms i den utan att textspalten blir oläslig. Texten är satt ett steg
 * mindre för att kortet ska behålla sin höjd.
 */
export function Premiumkort({ onPress }: { readonly onPress: () => void }): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const haptik = useHaptik();
  const { width } = useWindowDimensions();
  // Kortets inre bredd: skärmen minus skärmmarginalen och kortets padding.
  const inre = width - SKARMMARGINAL * 2 - 32;
  const loggbredd = Math.round(Math.min(132, Math.max(86, inre * 0.38)));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="TechRabbit kan mer än att räkna. Chatta med Rabbit AI om vad du vill. Gratis. Starta chatten"
      onPress={() => {
        haptik('latt');
        onPress();
      }}
      style={({ pressed }) => [
        styles.premium,
        {
          backgroundColor: farg['card'],
          borderColor: farg['greenEdge'],
          transform: [{ scale: pressed ? rorelse.tryckskala : 1 }],
        },
      ]}
    >
      <View style={[styles.premiumlogga, { width: loggbredd }]}>
        <LoggaTechRabbitAI bredd={loggbredd} />
      </View>

      <View style={styles.premiumtext}>
        <View style={[styles.gratis, { backgroundColor: farg['greenSoft'] }]}>
          <Text maxFontSizeMultiplier={1.3} style={[styles.gratistext, { color: farg['onGreenSoft'] }]}>
            GRATIS
          </Text>
        </View>
        <Text maxFontSizeMultiplier={1.5} style={[styles.premiumtitel, { color: farg['text'] }]}>
          TechRabbit kan mer än att räkna
        </Text>
        <Text maxFontSizeMultiplier={1.6} style={[styles.premiumbrod, { color: farg['muted'] }]}>
          Chatta med Rabbit AI om vad du vill.
        </Text>
        <Text maxFontSizeMultiplier={1.5} style={[styles.premiumlank, { color: farg['greenText'] }]}>
          Starta chatten →
        </Text>
      </View>
    </Pressable>
  );
}

/** Titlar i exempelkortet är vikt 800, inte radtitelns 600. */
const viktig = { fontFamily: 'Archivo_800ExtraBold' } as const;

const styles = StyleSheet.create({
  exempelyta: { flex: 1 },
  exempel: { flex: 1, minHeight: 76, borderRadius: 18, padding: 14, gap: 4, justifyContent: 'center' },
  fragekort: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 16, gap: 6 },
  fragehuvud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  versal: { textTransform: 'uppercase', letterSpacing: 0.6 },
  resultat: { borderRadius: 22, padding: 18, gap: 10 },
  resultatetikett: { fontSize: 14, lineHeight: 20, fontFamily: 'Archivo_700Bold' },
  resultatrad: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' },
  resultatvarde: { includeFontPadding: false },
  forklaringsetikett: { marginTop: 8, marginBottom: 4 },
  steg: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stegnummer: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stegtext: { flex: 1, gap: 2 },

  premium: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  premiumlogga: { justifyContent: 'center' },
  premiumtext: { flex: 1, gap: 2 },
  gratis: { alignSelf: 'flex-start', height: 20, borderRadius: 10, paddingHorizontal: 8, justifyContent: 'center' },
  gratistext: { fontSize: 10, fontFamily: 'Archivo_800ExtraBold', letterSpacing: 0.6, includeFontPadding: false },
  premiumtitel: { fontSize: 15, lineHeight: 20, fontFamily: 'Archivo_900Black' },
  premiumbrod: { fontSize: 13, lineHeight: 18, fontFamily: 'Archivo_500Medium' },
  premiumlank: { fontSize: 14, fontFamily: 'Archivo_800ExtraBold', includeFontPadding: false, marginTop: 1 },
});
