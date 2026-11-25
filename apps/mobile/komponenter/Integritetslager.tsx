/**
 * Appen i app-växlaren, rev-ux 2.4 (direktiv 41 steg 4).
 *
 * Telefonen tar en bild av appen när man lämnar den, och den bilden ligger i
 * app-växlaren. I den här appen står uträkningar och samtal på skärmen, och
 * de hör inte hemma i en bild som vem som helst kan bläddra fram.
 *
 * Därför: när appen slutar vara aktiv läggs ett suddigt lager över allt.
 * Lagret monteras UTAN animation — bilden tas inom en bråkdels sekund efter
 * att `inactive` kommer, och en intoning hade hunnit bli en halvsuddig bild.
 * När appen är tillbaka tonar lagret bort på 180 ms, som rev-ux 8.7 säger.
 *
 * Ingen haptik: den som inte tittar på skärmen ska inte känna en vibration
 * för att telefonen bytte app.
 *
 * ## Vad lagret INTE täcker
 *
 * Ark och dialoger ligger i egna `Modal`-fönster, och ett lager i appens
 * träd ligger inte över dem. Därför anropas samma lager också inne i
 * `Sheet.tsx` — arken är det enda som ritar i ett eget fönster.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { useTema } from '../design/tema';
import { REDUCERAD_MS, useRorelse } from '../lib/rorelse';

/** Hur suddigt. rev-ux 8.7 säger 40. */
const STYRKA = 40;

/** Bortoningen när appen är tillbaka. rev-ux 8.7. */
const TONING_MS = 180;

/** Sant när appen inte är aktiv: i app-växlaren, i bakgrunden eller avbruten. */
export function useAppDold(): boolean {
  const [dold, setDold] = useState(false);
  useEffect(() => {
    const prenumeration = AppState.addEventListener('change', (lage) => {
      // 'inactive' är iOS:ar mellanläge — app-växlaren och samtal — och det
      // är DÄR bilden tas. 'background' täcker Android.
      setDold(lage !== 'active');
    });
    return () => prenumeration.remove();
  }, []);
  return dold;
}

/** Själva lagret. Ritas bara när appen inte är aktiv. */
export function Integritetsslojan(): ReactNode {
  const { lage } = useTema();
  const rorelse = useRorelse();
  const dold = useAppDold();
  if (!dold) return null;
  return (
    <Animated.View
      // Ingen `entering`: lagret ska ligga där direkt, inte tona in.
      // Med "Reducera rörelse" på är toningen 160 ms, som allt annat.
      exiting={FadeOut.duration(rorelse.reducerad ? REDUCERAD_MS : TONING_MS)}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <BlurView
        intensity={STYRKA}
        tint={lage === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/** Appens träd med slöjan över. */
export function Integritetslager({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <View style={styles.fyll}>
      {children}
      <Integritetsslojan />
    </View>
  );
}

const styles = StyleSheet.create({
  fyll: { flex: 1 },
});
