/**
 * Progresssteget i vy 03 "Räknar".
 *
 * KOMPONENTER.md: 56 högt, ikon 28. Klar = greenSoft med bock, pågår = grön
 * ring med en stapel 4 pt, väntar = faint.
 * RORELSE-HAPTIK.md vy 03: stegen byts med en toning på 200 ms, stapeln fylls
 * linjärt, aldrig en evig spinner.
 */

import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTema } from '../design/tema';
import { TEXT } from '../design/tokens';
import { REDUCERAD_MS, useRorelse } from '../lib/rorelse';

export type Stegtillstand = 'klar' | 'pagar' | 'vantar';

export interface ProgressstegProps {
  readonly nr: number;
  readonly titel: string;
  readonly tillstand: Stegtillstand;
  readonly forst: boolean;
  /** Hur länge stapeln ska fyllas, i ms. Den stannar på 90 %. */
  readonly tid: number;
}

export function Progressteg({
  nr,
  titel,
  tillstand,
  forst,
  tid,
}: ProgressstegProps): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const andel = useSharedValue(0);

  useEffect(() => {
    if (tillstand === 'pagar') {
      // Linjärt till 90 %. Resten fylls när steget faktiskt blir klart.
      andel.value = withTiming(0.9, { duration: tid, easing: Easing.linear });
    } else if (tillstand === 'klar') {
      andel.value = withTiming(1, { duration: rorelse.reducerad ? REDUCERAD_MS : 200 });
    } else {
      andel.value = 0;
    }
  }, [tillstand, tid, andel, rorelse.reducerad]);

  const stapel = useAnimatedStyle(() => ({ width: `${andel.value * 100}%` }));

  const etikett =
    tillstand === 'klar' ? 'klart' : tillstand === 'pagar' ? 'pågår' : 'väntar';

  return (
    <View
      accessible
      accessibilityLabel={`Steg ${nr}: ${titel}, ${etikett}`}
      style={[
        styles.rad,
        forst ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: farg['border'] },
      ]}
    >
      <View
        style={[
          styles.markor,
          tillstand === 'klar'
            ? { backgroundColor: farg['greenSoft'] }
            : tillstand === 'pagar'
              ? { borderWidth: 2, borderColor: farg['greenIcon'] }
              : { borderWidth: 2, borderColor: farg['border'] },
        ]}
      >
        {tillstand === 'klar' ? (
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 12.5L10 17.5L19 7.5"
              stroke={farg['greenText']}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : (
          <Text
            maxFontSizeMultiplier={1.3}
            style={[
              TEXT['meta'],
              { color: tillstand === 'pagar' ? farg['text'] : farg['faint'] },
            ]}
          >
            {nr}
          </Text>
        )}
      </View>

      <View style={styles.text}>
        <Text
          maxFontSizeMultiplier={1.6}
          style={[
            TEXT['rowTitle'],
            tillstand === 'vantar' ? null : styles.aktiv,
            { color: tillstand === 'vantar' ? farg['faint'] : farg['text'] },
          ]}
        >
          {titel}
        </Text>
        {tillstand === 'pagar' ? (
          <View style={[styles.spar, { backgroundColor: farg['track'] }]}>
            <Animated.View
              style={[styles.fyllning, stapel, { backgroundColor: farg['greenIcon'] }]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rad: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  markor: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 8 },
  aktiv: { fontFamily: 'Archivo_800ExtraBold' },
  spar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fyllning: { height: 4, borderRadius: 2 },
});
