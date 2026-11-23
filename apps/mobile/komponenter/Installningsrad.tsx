/**
 * Inställningsraden, segmentet (Utseende) och switchen.
 *
 * KOMPONENTER.md: rad min 52 med 16/600 och värde 15/500 muted. Segment 40
 * högt med inre 3, radie 12/9, vald i vikt 800 på card. Switch 51 × 31, på i
 * greenIcon och av i track.
 * RORELSE-HAPTIK.md vy 09: switch och segment glider på 200 ms.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTema } from '../design/tema';
import { TEXT } from '../design/tokens';
import { useRorelse, YTA_MS } from '../lib/rorelse';

export function Installningsrad({
  titel,
  varde,
  onPress,
  forst,
}: {
  readonly titel: string;
  readonly varde?: string;
  readonly onPress?: () => void;
  readonly forst: boolean;
}): ReactNode {
  const { farg } = useTema();

  const innehall = (
    <>
      <Text maxFontSizeMultiplier={1.8} style={[TEXT['rowTitle'], { color: farg['text'] }]}>
        {titel}
      </Text>
      <View style={styles.hoger}>
        {varde !== undefined ? (
          <Text maxFontSizeMultiplier={1.6} style={[styles.varde, { color: farg['muted'] }]}>
            {varde}
          </Text>
        ) : null}
        {onPress ? (
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9.5 6l6 6-6 6"
              stroke={farg['faint']}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}
      </View>
    </>
  );

  const stil = [
    styles.rad,
    forst ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: farg['border'] },
  ];

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={varde ? `${titel}, ${varde}` : titel} style={stil}>
        {innehall}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={varde ? `${titel}, ${varde}` : titel}
      onPress={onPress}
      style={({ pressed }) => [...stil, pressed ? { backgroundColor: farg['inset'] } : null]}
    >
      {innehall}
    </Pressable>
  );
}

export interface SegmentProps<T extends string> {
  readonly etikett: string;
  readonly val: readonly { readonly varde: T; readonly titel: string }[];
  readonly valt: T;
  readonly onValj: (v: T) => void;
  readonly forst: boolean;
}

export function Segment<T extends string>({
  etikett,
  val,
  valt,
  onValj,
  forst,
}: SegmentProps<T>): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const index = Math.max(0, val.findIndex((v) => v.varde === valt));
  /**
   * Markören flyttas i punkter, med ett delat värde som sätts i en effekt.
   *
   * Direktiv 17 och 18: fliken Inställningar stängde appen direkt i det
   * fristående bygget, och det här är den enda skärmen i appen som hade både
   * ett tal med enhet (`left: '33%'`) i en `useAnimatedStyle` och en
   * `useDerivedValue` som returnerade en animation. Ingen modul saknas i
   * bygget (kontrollerat med expo-modules-autolinking), så det som är kvar
   * att misstänka är rörelsen — och i ett riktigt bygge blir ett fel i en
   * worklet en krasch i stället för en röd skärm.
   *
   * Nu används det vanligaste mönstret i stället: ett `useSharedValue` som
   * sätts i en effekt, och bara rena tal i den animerade stilen.
   *
   * Det är en misstanke, inte en mätning. Långtrycket på logotypen visar
   * vilken version som körs, så nästa försök går att läsa av.
   */
  const [bredd, setBredd] = useState(0);
  /** Segmentets inre padding är 3 pt på varje sida (KOMPONENTER.md). */
  const stegbredd = bredd > 0 ? Math.max(0, (bredd - 6) / val.length) : 0;
  const x = useSharedValue(0);
  const tid = rorelse.toning(YTA_MS);
  useEffect(() => {
    x.value = withTiming(index * stegbredd, tid);
  }, [index, stegbredd, x, tid]);
  const markor = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={[
        styles.segmentrad,
        forst ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: farg['border'] },
      ]}
    >
      <Text maxFontSizeMultiplier={1.8} style={[TEXT['rowTitle'], { color: farg['text'] }]}>
        {etikett}
      </Text>
      <View
        onLayout={(e) => setBredd(e.nativeEvent.layout.width)}
        style={[styles.segment, { backgroundColor: farg['track'] }]}
      >
        {stegbredd > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.markor, markor, { width: stegbredd, backgroundColor: farg['card'] }]}
          />
        ) : null}
        {val.map((v) => {
          const aktiv = v.varde === valt;
          return (
            <Pressable
              key={v.varde}
              accessibilityRole="radio"
              accessibilityLabel={v.titel}
              accessibilityState={{ selected: aktiv }}
              onPress={() => onValj(v.varde)}
              // Segmentrutan ar 34 pt hog inuti ett 40 pt segment.
              hitSlop={{ top: 6, bottom: 6 }}
              style={styles.segmentval}
            >
              <Text
                maxFontSizeMultiplier={1.4}
                style={[
                  styles.segmenttext,
                  aktiv ? styles.segmentvald : null,
                  { color: farg['text'] },
                ]}
              >
                {v.titel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Switchrad({
  titel,
  pa,
  onAndra,
  forst,
}: {
  readonly titel: string;
  readonly pa: boolean;
  readonly onAndra: (pa: boolean) => void;
  readonly forst: boolean;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  // Samma skäl som markören ovan: delat värde satt i en effekt, rena tal.
  const x = useSharedValue(pa ? 20 : 0);
  const tid = rorelse.toning(YTA_MS);
  useEffect(() => {
    x.value = withTiming(pa ? 20 : 0, tid);
  }, [pa, x, tid]);
  const knopp = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={titel}
      accessibilityState={{ checked: pa }}
      onPress={() => onAndra(!pa)}
      style={[
        styles.rad,
        forst ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: farg['border'] },
      ]}
    >
      <Text maxFontSizeMultiplier={1.8} style={[TEXT['rowTitle'], { color: farg['text'] }]}>
        {titel}
      </Text>
      <View style={[styles.switch, { backgroundColor: pa ? farg['greenIcon'] : farg['track'] }]}>
        <Animated.View style={[styles.knopp, knopp]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rad: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  hoger: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  varde: { fontSize: 15, fontFamily: 'Archivo_500Medium' },
  segmentrad: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  segment: {
    height: 40,
    borderRadius: 12,
    flexDirection: 'row',
    padding: 3,
  },
  markor: { position: 'absolute', left: 3, top: 3, bottom: 3, borderRadius: 9 },
  segmentval: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  segmenttext: { fontSize: 14, fontFamily: 'Archivo_500Medium' },
  segmentvald: { fontFamily: 'Archivo_800ExtraBold' },
  switch: { width: 51, height: 31, borderRadius: 16, padding: 2, justifyContent: 'center' },
  knopp: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#FFFFFF' },
});
