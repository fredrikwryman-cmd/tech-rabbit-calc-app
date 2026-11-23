/**
 * De snedställda banden i bakgrunden.
 *
 * Måtten är avlästa ur design/vyer/ (t.ex. 08_historik-tom_dark.png):
 * banden lutar ungefär 50 grader och är ungefär 180 pt breda, med lika brett
 * mellanrum. Tonskillnaden är liten med flit — banden ska kännas, inte synas.
 */

import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTema } from '../design/tema';

/** Lutning i grader. Negativt = banden går upp åt höger. */
const LUTNING = -50;
/** Bandets bredd och mellanrummets bredd, i pt. */
const BANDBREDD = 180;

/** Hur mycket ljusare bandet är än bakgrunden. */
const STYRKA: Readonly<Record<'light' | 'dark', string>> = {
  light: 'rgba(255,255,255,0.55)',
  dark: 'rgba(255,255,255,0.035)',
};

export function Bakgrund({ children }: { readonly children?: ReactNode }): ReactNode {
  const { farg, lage } = useTema();
  const { width, height } = useWindowDimensions();

  // Den roterade ytan måste täcka skärmens diagonal åt båda håll.
  const sida = (width + height) * 1.5;
  const antal = Math.ceil(sida / (BANDBREDD * 2)) + 1;

  return (
    <View style={[styles.rot, { backgroundColor: farg['bg'] }]}>
      <View
        pointerEvents="none"
        style={[
          styles.banden,
          {
            width: sida,
            height: sida,
            left: (width - sida) / 2,
            top: (height - sida) / 2,
            transform: [{ rotate: `${LUTNING}deg` }],
          },
        ]}
      >
        {Array.from({ length: antal }, (_, i) => (
          <View
            key={i}
            style={{
              height: BANDBREDD,
              marginBottom: BANDBREDD,
              backgroundColor: STYRKA[lage],
            }}
          />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  rot: { flex: 1 },
  banden: { position: 'absolute' },
});
