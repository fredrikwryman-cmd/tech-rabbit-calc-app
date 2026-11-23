/**
 * Bekräftelsedialogen, vy 09b.
 *
 * KOMPONENTER.md: max 330 bred, padding 22/20, radie 24, dimmer 45 %,
 * titel 20/900, text 15/21, på card.
 * RORELSE-HAPTIK.md vy 09b: dimmern och dialogen tonas in på 200 ms.
 */

import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTema } from '../design/tema';
import { TEXT } from '../design/tokens';
import { REDUCERAD_MS, useRorelse, YTA_MS } from '../lib/rorelse';

import { DestruktivKnapp, SekundarKnapp } from './Knapp';

export interface BekraftelsedialogProps {
  readonly oppen: boolean;
  readonly titel: string;
  readonly text: string;
  readonly bekraftaTitel: string;
  readonly avbrytTitel?: string;
  readonly onBekrafta: () => void;
  readonly onAvbryt: () => void;
}

export function Bekraftelsedialog({
  oppen,
  titel,
  text,
  bekraftaTitel,
  avbrytTitel = 'Avbryt',
  onBekrafta,
  onAvbryt,
}: BekraftelsedialogProps): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const tid = rorelse.reducerad ? REDUCERAD_MS : YTA_MS;

  return (
    <Modal
      visible={oppen}
      transparent
      animationType="none"
      onRequestClose={onAvbryt}
      accessibilityViewIsModal
      statusBarTranslucent
    >
      <Animated.View entering={FadeIn.duration(tid)} style={styles.dimmer}>
        {/* Tryck utanför avbryter, precis som Escape på en dator. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stäng"
          style={StyleSheet.absoluteFill}
          onPress={onAvbryt}
        />
        <Animated.View
          entering={FadeIn.duration(tid)}
          accessibilityViewIsModal
          style={[styles.dialog, { backgroundColor: farg['card'] }]}
        >
          <View style={styles.text}>
            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={1.6}
              style={[styles.titel, { color: farg['text'] }]}
            >
              {titel}
            </Text>
            <Text maxFontSizeMultiplier={1.8} style={[TEXT['secondary'], styles.brod, { color: farg['muted'] }]}>
              {text}
            </Text>
          </View>
          <DestruktivKnapp titel={bekraftaTitel} onPress={onBekrafta} />
          <SekundarKnapp titel={avbrytTitel} onPress={onAvbryt} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dimmer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 330,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
  },
  text: { gap: 6, marginBottom: 6 },
  titel: { fontSize: 20, fontFamily: 'Archivo_900Black', includeFontPadding: false },
  brod: { fontSize: 15, lineHeight: 21 },
});
