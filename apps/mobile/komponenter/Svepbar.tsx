/**
 * Svep åt vänster för att ta bort, som i Meddelanden på iPhonen.
 *
 * Bruten ur Historikrad i direktiv 15, så att samtalsraderna i 21f kan svepas
 * på exakt samma sätt — samma bredd, samma färg, samma rörelse. Historiken och
 * Tidigare samtal ska inte kunna glida isär.
 *
 * KOMPONENTER.md: Ta bort-ytan är 96 pt bred i `burnFill`.
 * RORELSE-HAPTIK.md vy 07: svepet följer fingret, och raden som tas bort fälls
 * ihop på 200 ms. Med reducerad rörelse svepet är avstängt — raderna tas bort
 * med knappen eller menyn i stället, så ingen blir utan vägen.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTema } from '../design/tema';
import { TEXT } from '../design/tokens';
import { REDUCERAD_MS, useRorelse, YTA_MS } from '../lib/rorelse';

/** Bredden på Ta bort-ytan bakom raden. */
export const TABORT_BREDD = 96;

export function IkonPapperskorg({
  farg,
  storlek = 20,
}: {
  readonly farg: string;
  readonly storlek?: number;
}): ReactNode {
  return (
    <Svg width={storlek} height={storlek} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6.5h16M9.5 6.5V4.8h5v1.7M6.8 6.5l.9 12.2a1.5 1.5 0 0 0 1.5 1.4h5.6a1.5 1.5 0 0 0 1.5-1.4l.9-12.2"
        stroke={farg}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export interface SvepbarProps {
  /** Vad VoiceOver läser på Ta bort-knappen, t.ex. frågan eller rubriken. */
  readonly etikett: string;
  /** Körs när raden är ihopfälld. Då, inte innan — annars hoppar listan. */
  readonly onTaBort: () => void;
  /**
   * Direktiv 41: fråga innan raden tas bort.
   *
   * Får Svepbar den här körs den i stället för borttagningen, med
   * ihopfällningen som argument: värden visar sin bekräftelserad och anropar
   * `ja()` när användaren sagt ja. Avbryter användaren händer ingenting och
   * raden ligger kvar öppen.
   *
   * Dialogen bor hos värden och inte här, för att samma dialog ska kunna
   * täcka BÅDA vägarna ut — svepet och …-menyn på raden. Två dialoger för
   * samma borttagning hade kunnat glida isär.
   */
  readonly bekrafta?: (ja: () => void) => void;
  /**
   * Radens innehåll.
   *
   * `stangOmOppen` returnerar sant när svepet var öppet och stängdes. Ett
   * tryck på en öppen rad ska stänga svepet, inte öppna raden — därför måste
   * innehållet kunna fråga.
   */
  readonly children: (stangOmOppen: () => boolean) => ReactNode;
}

export function Svepbar({ etikett, onTaBort, bekrafta, children }: SvepbarProps): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const x = useSharedValue(0);
  const hojd = useSharedValue<number | 'auto'>('auto');
  const opacitet = useSharedValue(1);

  const stangOmOppen = (): boolean => {
    if (x.value === 0) return false;
    x.value = withTiming(0, rorelse.toning(YTA_MS));
    return true;
  };

  /** Fäller ihop raden på 200 ms och tar sedan bort den på riktigt. */
  const taBortMedRorelse = (): void => {
    const tid = rorelse.reducerad ? REDUCERAD_MS : YTA_MS;
    opacitet.value = withTiming(0, { duration: tid });
    hojd.value = withTiming(0, { duration: tid }, (klar) => {
      if (klar) runOnJS(onTaBort)();
    });
  };

  /** Vägen ut ur Ta bort-knappen: fråga först när värden vill det. */
  const tryckTaBort = (): void => {
    if (bekrafta === undefined) {
      taBortMedRorelse();
      return;
    }
    bekrafta(taBortMedRorelse);
  };

  // Svepet följer fingret och fastnar vid Ta bort-ytan.
  const svep = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const nytt = Math.min(0, Math.max(-TABORT_BREDD, e.translationX));
      x.value = rorelse.reducerad ? 0 : nytt;
    })
    .onEnd((e) => {
      if (rorelse.reducerad) return;
      const oppna = e.translationX < -TABORT_BREDD / 2 || e.velocityX < -500;
      x.value = withTiming(oppna ? -TABORT_BREDD : 0, { duration: YTA_MS });
    });

  const radstil = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const ytterstil = useAnimatedStyle(() => ({
    opacity: opacitet.value,
    ...(hojd.value === 'auto' ? {} : { height: hojd.value }),
  }));

  return (
    <Animated.View style={[styles.ytter, ytterstil]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ta bort. ${etikett}`}
        onPress={tryckTaBort}
        style={[styles.tabort, { backgroundColor: farg['burnFill'] }]}
      >
        <IkonPapperskorg farg={farg['onBurn'] ?? '#fff'} />
        <Text maxFontSizeMultiplier={1.4} style={[TEXT['secondary'], { color: farg['onBurn'] }]}>
          Ta bort
        </Text>
      </Pressable>

      <GestureDetector gesture={svep}>
        <Animated.View style={radstil}>{children(stangOmOppen)}</Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ytter: { overflow: 'hidden' },
  tabort: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: TABORT_BREDD,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
