/**
 * Sheeten: ytan som glider upp ovanpå skärmen (Räkna vidare och Dela).
 *
 * KOMPONENTER.md: 62 pt från skärmens överkant, radie 22, grabber, rubrik och
 * en stängknapp 44 × 44. RORELSE-HAPTIK.md: upp på 280 ms, och med reducerad
 * rörelse tonas den in i stället för att glida.
 *
 * ResultatSheet har sin egen kopia av den här ytan sedan direktiv 11. Den
 * bär paging, svep och en egen fot, så den är inte flyttad hit — men nya
 * sheetar byggs på den här.
 */

import { useEffect, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Integritetsslojan } from './Integritetslager';
import { KLAR_ID_ARK, Klarrad, TANGENTBORDSBETEENDE } from './Tangentbord';
import { useTema } from '../design/tema';
import { SKARMMARGINAL, TEXT } from '../design/tokens';
import { REDUCERAD_MS, rm, useHaptik, useRorelse } from '../lib/rorelse';
import { useAnmalArk } from '../lib/ark';

/** Avståndet från skärmens överkant, enligt KOMPONENTER.md. */
const TOPP = 62;

export interface SheetProps {
  readonly oppen: boolean;
  readonly titel: string;
  readonly onStang: () => void;
  readonly children: ReactNode;
  /** Knapparna längst ned. Ligger stilla medan innehållet rullar. */
  readonly fot?: ReactNode;
}

export function Sheet({ oppen, titel, onStang, children, fot }: SheetProps): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const haptik = useHaptik();
  const { height } = useWindowDimensions();

  /* Sidan bakom sjunker sa lange arket ar oppet (A3). Se lib/ark.tsx. */
  useAnmalArk(oppen);

  const y = useSharedValue(height);
  const dra = useSharedValue(0);
  const opacitet = useSharedValue(0);
  const arkhojd = Math.max(1, height - TOPP);

  useEffect(() => {
    if (!oppen) {
      y.value = height;
      dra.value = 0;
      opacitet.value = 0;
      return;
    }
    dra.value = 0;
    if (rorelse.reducerad) {
      y.value = 0;
      opacitet.value = withTiming(1, { duration: REDUCERAD_MS });
    } else {
      opacitet.value = 1;
      y.value = withSpring(0, rm.smooth);
    }
  }, [oppen, height, rorelse.reducerad, y, dra, opacitet]);

  function stangNer(): void {
    dra.value = 0;
    y.value = height;
    onStang();
  }

  function snappTillbaka(): void {
    haptik('mjuk');
  }

  /** Arket foljer fingret; dra ned stanger, slapp under halva vagen fjadrar. */
  const dragning = Gesture.Pan()
    .enabled(!rorelse.reducerad)
    .onUpdate((e) => {
      dra.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (dra.value > arkhojd / 2 || e.velocityY > 900) {
        runOnJS(stangNer)();
        return;
      }
      dra.value = withSpring(0, rm.smooth);
      runOnJS(snappTillbaka)();
    });

  const stil = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value + dra.value }],
    opacity: opacitet.value,
  }));

  const dimmer = useAnimatedStyle(() => ({
    opacity: interpolate(y.value + dra.value, [0, arkhojd], [rm.recedeDim, 0], 'clamp'),
  }));

  return (
    <Modal
      visible={oppen}
      transparent
      animationType="none"
      onRequestClose={onStang}
      accessibilityViewIsModal
      statusBarTranslucent
    >
      <View style={styles.rot}>
        {/* Skarmen bakom morknar (rm.recedeDim). Tryck utanfor stanger. */}
        <Animated.View style={[styles.dimmer, dimmer]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Stäng ${titel.toLowerCase()}`}
            onPress={stangNer}
            style={styles.fyll}
          />
        </Animated.View>
        <Animated.View style={[styles.sheet, stil, { top: TOPP, backgroundColor: farg['bg'] }]}>
          <GestureDetector gesture={dragning}>
            <View>
          <View style={[styles.grabber, { backgroundColor: farg['controlBorder'] }]} />
          <View style={styles.huvud}>
            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={1.5}
              style={[TEXT['sheetTitle'], { color: farg['text'] }]}
            >
              {titel}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Stäng ${titel.toLowerCase()}`}
              onPress={onStang}
              style={[styles.stang, { backgroundColor: farg['track'] }]}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6.5 6.5l11 11M17.5 6.5l-11 11"
                  stroke={farg['text']}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </View>
            </View>
          </GestureDetector>

          <KeyboardAvoidingView
            behavior={TANGENTBORDSBETEENDE}
            /* Vyn mäter sitt eget läge: arkets överkant räknas in (direktiv 41). */
            automaticOffset
            style={styles.fyll}
          >
            <ScrollView
              contentContainerStyle={styles.innehall}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {children}
            </ScrollView>
            {fot === undefined ? null : <View style={styles.fot}>{fot}</View>}
            <Klarrad id={KLAR_ID_ARK} />
          </KeyboardAvoidingView>
        </Animated.View>

        {/*
          rev-ux 2.4: arket ligger i ett eget fönster, så appens slöja når
          inte hit. Den ritas därför en gång till här — annars vore just
          uträkningen det enda som syntes i app-växlaren.
        */}
        <Integritetsslojan />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rot: { flex: 1 },
  fyll: { flex: 1 },
  dimmer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#000' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 16,
  },
  grabber: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 10 },
  huvud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SKARMMARGINAL,
    paddingBottom: 12,
  },
  stang: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  innehall: { paddingHorizontal: SKARMMARGINAL, paddingBottom: 20, gap: 12 },
  fot: { paddingHorizontal: SKARMMARGINAL, paddingTop: 10, paddingBottom: 34 },
});
