/**
 * Skelettet medan svaret räknas, rev-ux 2.2: "skeleton i rätt form, aldrig
 * en ensam spinner".
 *
 * Formen är resultatkortets: etikettraden, det stora talet och radernas
 * plats. Den som väntar ser alltså var svaret kommer att stå, och kortet
 * byter inte höjd när det landar.
 *
 * Ytorna hämtar färg ur temat (`track` och `card`) — komponenten bestämmer
 * ingen färg själv.
 */

import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTema } from '../design/tema';
import { useRorelse } from '../lib/rorelse';

/** En pulserande yta. Bredden är andel av raden, höjden punkter. */
function Yta({
  bredd,
  hojd,
  puls,
}: {
  readonly bredd: number | string;
  readonly hojd: number;
  readonly puls: ReturnType<typeof useAnimatedStyle>;
}): ReactNode {
  const { farg } = useTema();
  return (
    <Animated.View
      style={[
        styles.yta,
        puls,
        {
          width: bredd as number,
          height: hojd,
          borderRadius: Math.min(10, hojd / 2),
          backgroundColor: farg['track'],
        },
      ]}
    />
  );
}

export interface SkelettProps {
  /** Hur många rader svaret väntas ha under talet. */
  readonly rader?: number;
}

/**
 * Resultatkortets skelett.
 *
 * Pulsen är en toning mellan två opaciteter, inte en rörelse: med reducerad
 * rörelse ligger den still på ett fast värde i stället för att loopa.
 */
export function Resultatskelett({ rader = 2 }: SkelettProps): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const liv = useSharedValue(0.55);

  useEffect(() => {
    if (rorelse.reducerad) {
      liv.value = 0.6;
      return;
    }
    liv.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [rorelse.reducerad, liv]);

  const puls = useAnimatedStyle(() => ({ opacity: liv.value }));

  return (
    <View
      accessible
      accessibilityLabel="Räknar fram svaret"
      accessibilityState={{ busy: true }}
      style={[styles.kort, { backgroundColor: farg['card'] }]}
    >
      {/* Etiketten över talet. */}
      <Yta bredd="42%" hojd={14} puls={puls} />
      {/* Det stora talet: samma höjd som result-stilens radhöjd. */}
      <View style={styles.talrad}>
        <Yta bredd="56%" hojd={52} puls={puls} />
        <Yta bredd={46} hojd={26} puls={puls} />
      </View>
      {/* Raderna under talet. */}
      {rader > 0 ? (
        <View style={[styles.rader, { borderTopColor: farg['border'] }]}>
          {Array.from({ length: rader }, (_, i) => (
            <View key={i} style={styles.rad}>
              <Yta bredd="38%" hojd={13} puls={puls} />
              <Yta bredd="22%" hojd={13} puls={puls} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kort: { borderRadius: 20, padding: 18, gap: 14 },
  talrad: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  rader: { paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, gap: 12 },
  rad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yta: { overflow: 'hidden' },
});
