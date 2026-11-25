/**
 * Tabbarna: Räkna, Rabbit AI, Historik och Inställningar (v4).
 *
 * Mått enligt KOMPONENTER.md: 58 pt plus säkert område, ikon 25, etikett 11,
 * vald etikett i vikt 800 och grön färg.
 */

import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useTema } from '../../design/tema';
import { iVikt, TEXT, type Palett } from '../../design/tokens';
import {
  IkonHistorik,
  IkonInstallningar,
  IkonRabbitAI,
  IkonRakna,
  type IkonProps,
} from '../../komponenter/Ikoner';
import { haptic, rm, useRorelse } from '../../lib/rorelse';

const TABBHOJD = 58;

/**
 * Rabbit AI-fliken har inte en streckikon utan symbolen, så den ritas för sig.
 * Ovald är den gråskala med 75 % opacitet, enligt KOMPONENTER.md v4.
 */
function RabbitFlik({ vald, farg }: { readonly vald: boolean; readonly farg: Palett }): ReactNode {
  if (vald) {
    return (
      <IkonRabbitAI
        farg={farg['text'] ?? '#000'}
        detalj={farg['greenIcon'] ?? '#1ED63C'}
        gnista={farg['greenIcon'] ?? '#1ED63C'}
      />
    );
  }
  const gra = farg['muted'] ?? '#5A5A5A';
  return (
    <View style={{ opacity: 0.75 }}>
      <IkonRabbitAI farg={gra} detalj={gra} gnista={gra} />
    </View>
  );
}

/**
 * Fliksikonen som studsar latt nar fliken valjs (rev-ux A11).
 *
 * `hero`-fjadern ar den med liten overstudsning, sa ikonen gar en gnutta
 * forbi sitt lage och tillbaka. Med reducerad rorelse ligger den still:
 * studsen ar forflyttning, och forflyttning ar just det som stangs av.
 */
function Flikikon({ vald, children }: { readonly vald: boolean; readonly children: ReactNode }): ReactNode {
  const rorelse = useRorelse();
  const skala = useSharedValue(1);

  useEffect(() => {
    if (!vald || rorelse.reducerad) return;
    skala.value = 0.86;
    skala.value = withSpring(1, rm.hero);
  }, [vald, rorelse.reducerad, skala]);

  const stil = useAnimatedStyle(() => ({ transform: [{ scale: skala.value }] }));
  return <Animated.View style={stil}>{children}</Animated.View>;
}

const FLIKAR = [
  { namn: 'index', titel: 'Räkna', Ikon: IkonRakna },
  { namn: 'rabbit-ai', titel: 'Rabbit AI', Ikon: null },
  { namn: 'historik', titel: 'Historik', Ikon: IkonHistorik },
  { namn: 'installningar', titel: 'Inställningar', Ikon: IkonInstallningar },
] as const satisfies readonly {
  namn: string;
  titel: string;
  Ikon: ((p: IkonProps) => ReactNode) | null;
}[];

export default function TabbLayout(): ReactNode {
  const { farg } = useTema();
  /**
   * Direktiv 33: flikraden lamnade 12 pt pa Android, oavsett telefon.
   *
   * Med edge-to-edge ritar appen under navigeringsfaltet, och det ar 0 pt
   * med knappar, ~24 med gestbage och mer pa vissa telefoner. Insetet ar det
   * enda som vet. Pa iOS ger det 34 pa en telefon med hemstreck och 0 pa en
   * med hemknapp — samma siffror som den fasta ternaren gav, men uppmatta.
   */
  const insets = useSafeAreaInsets();
  const under = Math.max(insets.bottom, 12);
  const vald = farg['greenIcon']!;
  const ovald = farg['muted']!;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: TABBHOJD + under,
          paddingTop: 6,
          paddingBottom: under - 12 > 0 ? under - 12 : 0,
          backgroundColor: farg['chrome'],
          borderTopColor: farg['border'],
        },
        tabBarItemStyle: { minHeight: 44 },
      }}
    >
      {FLIKAR.map(({ namn, titel, Ikon }) => (
        <Tabs.Screen
          key={namn}
          name={namn}
          /* rev-ux haptikkartan: flikbyte ger `selection`. */
          listeners={{ tabPress: () => haptic('val') }}
          options={{
            title: titel,
            tabBarAccessibilityLabel: titel,
            tabBarIcon: ({ focused }) => (
              <Flikikon vald={focused}>
                {Ikon === null ? (
                  <RabbitFlik vald={focused} farg={farg} />
                ) : (
                  <Ikon farg={focused ? vald : ovald} />
                )}
              </Flikikon>
            ),
            // Vald flik: vikt 800 och grön text. Övriga: vikt 500 och dämpad.
            tabBarLabel: ({ focused }) => (
              <Text
                // Flikraden ar 58 pt hog: en etikett som skalar fritt skjuter
                // ikonen ur rutan. Taket ar 1,2 och raden bryts aldrig.
                maxFontSizeMultiplier={1.2}
                numberOfLines={1}
                style={[
                  focused ? iVikt(TEXT['tab']!, 800) : TEXT['tab'],
                  { color: focused ? farg['greenText'] : ovald, marginTop: 2 },
                ]}
              >
                {titel}
              </Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
