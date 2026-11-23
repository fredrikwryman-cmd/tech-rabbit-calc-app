/**
 * Startskärmen, vy 22.
 *
 * KOMPONENTER.md v4: `bg` med symbolen 104 pt och "Tech Rabbit Calc" 28/900,
 * 16 pt mellanrum, centrerat.
 *
 * RORELSE-HAPTIK.md v4: ingen animation. Skärmen byts till appen med en
 * toning på 200 ms.
 *
 * Den ritas INUTI appen, ovanpå navigationen, och inte som systemets
 * startbild. Skälet är texten: systemets startbild är en enda bild, och
 * appnamnet ska sättas i Archivo tillsammans med symbolen. Systemets
 * startbild bär bara bakgrundsfärgen, så att det inte blinkar emellan.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import { useTema } from '../design/tema';
import { REDUCERAD_MS, useRorelse, YTA_MS } from '../lib/rorelse';

import { Logotyp } from './Logotyp';

/** Hur länge startskärmen ligger kvar innan den tonas bort. */
const VISAS_MS = 650;

export function Startskarm({ children }: { readonly children: ReactNode }): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const [klar, setKlar] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setKlar(true), VISAS_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.fyll}>
      {children}
      {klar ? null : (
        <Animated.View
          exiting={FadeOut.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
          pointerEvents="none"
          accessible
          accessibilityLabel="Tech Rabbit Calc"
          style={[styles.yta, { backgroundColor: farg['bg'] }]}
        >
          <Logotyp storlek={104} />
          <Text style={[styles.namn, { color: farg['text'] }]}>Tech Rabbit Calc</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fyll: { flex: 1 },
  yta: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  namn: { fontSize: 28, fontFamily: 'Archivo_900Black', includeFontPadding: false },
});
