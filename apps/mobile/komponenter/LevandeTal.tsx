/**
 * Huvudsvaret som levande värde, rev-ux A10 och 8.3.
 *
 * Talet rullar in siffra för siffra, siffrorna är tabulära så att inget
 * hoppar i sidled när de byts, och texten krymper när talet blir långt i
 * stället för att klippas.
 *
 * Komponenten bestämmer INGET utseende: färg, typsnitt och grundstorlek
 * kommer in som `stil` från temat. Den rör bara storleken — och bara nedåt.
 *
 * Räkningen ligger i lib/levande-tal.ts, så den går att testa utan att
 * rendera något.
 */

import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';

import { krympfaktor, tecken } from '../lib/levande-tal';
import { REDUCERAD_MS, rm, useRorelse } from '../lib/rorelse';

export interface LevandeTalProps {
  /** Talet som färdig text, t.ex. "1 234,50". Formateras inte här. */
  readonly varde: string;
  /** Enheten efter talet, t.ex. "kr". Rullar inte: den byts sällan. */
  readonly enhet?: string;
  /** Talets stil ur temat. `fontSize` är grundstorleken talet krymper från. */
  readonly stil: TextStyle;
  /** Enhetens stil ur temat. Krymper i samma takt som talet. */
  readonly enhetsstil?: TextStyle;
  /** Hela svaret i ett stycke, för VoiceOver. */
  readonly etikett?: string;
}

export function LevandeTal({
  varde,
  enhet,
  stil,
  enhetsstil,
  etikett,
}: LevandeTalProps): ReactNode {
  const rorelse = useRorelse();
  const faktor = krympfaktor([...varde].length);
  const grund = typeof stil.fontSize === 'number' ? stil.fontSize : 60;
  const storlek = Math.round(grund * faktor);
  const radhojd =
    typeof stil.lineHeight === 'number' ? Math.round(stil.lineHeight * faktor) : undefined;

  const enhetsgrund =
    enhetsstil !== undefined && typeof enhetsstil.fontSize === 'number' ? enhetsstil.fontSize : 22;

  /**
   * Med reducerad rörelse står talet still och tonas in i ett stycke: ingen
   * förflyttning, ingen fjädring, bara 160 ms (direktiv 39).
   */
  const rullaIn = rorelse.reducerad
    ? FadeIn.duration(REDUCERAD_MS)
    : FadeInDown.springify().damping(rm.bubble.damping).stiffness(rm.bubble.stiffness);
  const rullaUt = rorelse.reducerad ? FadeIn.duration(0) : FadeOutUp.duration(120);

  const layout = rorelse.reducerad
    ? undefined
    : LinearTransition.springify().damping(rm.smooth.damping).stiffness(rm.smooth.stiffness);

  return (
    <View
      accessible
      accessibilityLabel={etikett ?? `${varde}${enhet === undefined ? '' : ` ${enhet}`}`}
      style={styles.rad}
    >
      {/*
        Hela raden är EN tillgänglighetsnod: annars läser VoiceOver upp
        siffrorna en och en, och "ett, två, tre" är inte svaret 123.
      */}
      <Animated.View
        accessible={false}
        layout={layout}
        style={styles.tal}
        // Siffrorna ligger som text på en baslinje, inte som en lista.
        importantForAccessibility="no-hide-descendants"
      >
        {tecken(varde).map((t) => (
          <Animated.Text
            key={t.nyckel}
            entering={rullaIn}
            exiting={rullaUt}
            allowFontScaling
            maxFontSizeMultiplier={1.4}
            style={[
              stil,
              styles.siffra,
              { fontSize: storlek },
              radhojd === undefined ? null : { lineHeight: radhojd },
            ]}
          >
            {t.tecken}
          </Animated.Text>
        ))}
      </Animated.View>
      {enhet === undefined || enhet === '' ? null : (
        <Text
          accessible={false}
          maxFontSizeMultiplier={1.4}
          style={[enhetsstil, { fontSize: Math.round(enhetsgrund * faktor) }]}
        >
          {enhet}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rad: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 },
  tal: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 1 },
  /**
   * Tabulära siffror: varje siffra tar samma bredd, så raden står still när
   * en siffra byts mot en annan. Utan den hoppar talet i sidled vid varje
   * rullning.
   */
  siffra: { fontVariant: ['tabular-nums'], includeFontPadding: false },
});
