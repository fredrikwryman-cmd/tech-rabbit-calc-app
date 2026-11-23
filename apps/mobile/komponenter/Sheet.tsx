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
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { KLAR_ID_ARK, Klarrad } from './Tangentbord';
import { useTema } from '../design/tema';
import { SKARMMARGINAL, TEXT } from '../design/tokens';
import { REDUCERAD_MS, SKARM_MS, useRorelse } from '../lib/rorelse';

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
  const { height } = useWindowDimensions();

  const y = useSharedValue(height);
  const opacitet = useSharedValue(0);

  useEffect(() => {
    if (!oppen) {
      y.value = height;
      opacitet.value = 0;
      return;
    }
    if (rorelse.reducerad) {
      y.value = 0;
      opacitet.value = withTiming(1, { duration: REDUCERAD_MS });
    } else {
      opacitet.value = 1;
      y.value = withTiming(0, rorelse.toning(SKARM_MS));
    }
  }, [oppen, height, rorelse, y, opacitet]);

  const stil = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: opacitet.value,
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
        <Animated.View style={[styles.sheet, stil, { top: TOPP, backgroundColor: farg['bg'] }]}>
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

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rot: { flex: 1 },
  fyll: { flex: 1 },
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
