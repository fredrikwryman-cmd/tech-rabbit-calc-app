/**
 * Röstinmatningens delar: vy 40, 40b och 41 i design v4.
 *
 * KOMPONENTER.md v4:
 * - Mikrofonknapp 40 (38 i kompositören), cirkel. Vila `inset`/`text`,
 *   lyssnar grön gradient/`onGreen`, nekad `track`/`faint` med överstruken
 *   mikrofon.
 * - Lyssnarkort (Räkna): `card`, radie 20, punkt 8 `greenIcon`,
 *   "Lyssnar …" 14/700, Klar-knapp 44 (`text`/`bg`), vågform 32 hög med
 *   staplar 3 pt i `greenIcon`, och hjälptexten
 *   "Inget skickas förrän du trycker Räkna."
 * - Nekad (41): kort med rubrik 17/900, förklaring 14/20 `muted` och
 *   sekundärknappen "Öppna Inställningar".
 *
 * RORELSE-HAPTIK.md v4: knappen blir grön på 150 ms, vågformen tonas in,
 * staplarna följer ljudnivån (högst 30 gånger per sekund) och tonas ut på
 * 150 ms. Med reducerad rörelse visar vågformen en statisk nivå.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useTema } from '../design/tema';
import { TEXT } from '../design/tokens';
import { REDUCERAD_MS, useHaptik, useRorelse, YTA_MS } from '../lib/rorelse';
import type { Rostlage } from '../lib/rost';

import { SekundarKnapp } from './Knapp';

/** Hur många staplar vågformen har. */
const STAPLAR = 13;

export interface MikrofonknappProps {
  readonly lage: Rostlage;
  readonly storlek?: number;
  readonly onStarta: () => void;
  readonly onStoppa: () => void;
}

/** Mikrofonknappen i fältet. */
export function Mikrofonknapp({
  lage,
  storlek = 40,
  onStarta,
  onStoppa,
}: MikrofonknappProps): ReactNode {
  const { farg } = useTema();
  const haptik = useHaptik();
  const lyssnar = lage === 'lyssnar';
  const nekad = lage === 'nekad';

  const etikett = lyssnar
    ? 'Avsluta inspelning'
    : nekad
      ? 'Mikrofonen är avstängd'
      : 'Prata in fråga';

  const ikonfarg = lyssnar ? farg['onGreen'] : nekad ? farg['faint'] : farg['text'];
  const ikonmatt = Math.round(storlek * 0.5);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etikett}
      accessibilityState={{ selected: lyssnar }}
      onPress={() => {
        haptik('latt');
        if (lyssnar) onStoppa();
        else onStarta();
      }}
      style={({ pressed }) => [
        styles.mik,
        {
          width: storlek,
          height: storlek,
          borderRadius: storlek / 2,
          backgroundColor: lyssnar ? 'transparent' : nekad ? farg['track'] : farg['inset'],
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {lyssnar ? (
        /*
          Måtten i PUNKTER, inte procent: en Svg utan viewBox har ingen egen
          koordinatrymd att räkna procent mot, och ytan hamnade snett på
          knappen Räkna vidare av just det skälet (direktiv 27). Mikrofonen
          vet sin storlek i förväg, så här behövs ingen mätning.
        */
        <Svg style={styles.fyllut} width={storlek} height={storlek}>
          <Defs>
            <LinearGradient
              id="mik"
              x1={0}
              y1={0}
              x2={storlek}
              y2={storlek}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={farg['greenFrom']} />
              <Stop offset="1" stopColor={farg['greenTo']} />
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={storlek}
            height={storlek}
            rx={storlek / 2}
            fill="url(#mik)"
          />
        </Svg>
      ) : null}

      <Svg width={ikonmatt} height={ikonmatt} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3.6a2.9 2.9 0 0 0-2.9 2.9v5a2.9 2.9 0 0 0 5.8 0v-5A2.9 2.9 0 0 0 12 3.6z"
          stroke={ikonfarg}
          strokeWidth={1.9}
        />
        <Path
          d="M5.8 11a6.2 6.2 0 0 0 12.4 0M12 17.2V20.4M9 20.4h6"
          stroke={ikonfarg}
          strokeWidth={1.9}
          strokeLinecap="round"
        />
        {nekad ? (
          <Path d="M4 20 20 4" stroke={ikonfarg} strokeWidth={1.9} strokeLinecap="round" />
        ) : null}
      </Svg>
    </Pressable>
  );
}

/**
 * Vågformen. Staplarna följer ljudnivån.
 *
 * Varje stapel har en egen vikt, så att formen rör sig i stället för att alla
 * staplar hoppa lika. Nivån kommer redan strypt till 10 gånger per sekund från
 * modulen, vilket ligger under taket på 30.
 */
export function Vagform({ niva }: { readonly niva: number }): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  // Fasta vikter, inte slump: formen ska se likadan ut varje gång.
  const vikter = [0.35, 0.6, 0.85, 0.5, 1, 0.7, 0.95, 0.55, 0.9, 0.45, 0.8, 0.6, 0.3];
  return (
    <View style={styles.vagform} accessibilityElementsHidden importantForAccessibility="no">
      {Array.from({ length: STAPLAR }, (_, i) => {
        const vikt = vikter[i] ?? 0.5;
        // Med reducerad rörelse står vågformen stilla på en halv nivå.
        const h = rorelse.reducerad ? 16 * vikt : 6 + 26 * niva * vikt;
        return (
          <View
            key={i}
            style={[styles.stapel, { height: Math.max(3, Math.min(32, h)), backgroundColor: farg['greenIcon'] }]}
          />
        );
      })}
    </View>
  );
}

/** Vy 40: lyssnarkortet på Räkna. */
export function Lyssnarkort({
  niva,
  onKlar,
}: {
  readonly niva: number;
  readonly onKlar: () => void;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const tid = rorelse.reducerad ? REDUCERAD_MS : 150;

  return (
    <Animated.View
      entering={FadeIn.duration(tid)}
      exiting={FadeOut.duration(tid)}
      accessible
      accessibilityLabel="Lyssnar. Inget skickas förrän du trycker Räkna."
      style={[styles.lyssnarkort, { backgroundColor: farg['card'] }]}
    >
      <View style={styles.lyssnarrad}>
        <View style={[styles.punkt, { backgroundColor: farg['greenIcon'] }]} />
        <Text maxFontSizeMultiplier={1.5} style={[styles.lyssnartext, styles.fyll, { color: farg['text'] }]}>
          Lyssnar …
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Klar"
          onPress={onKlar}
          style={({ pressed }) => [
            styles.klar,
            { backgroundColor: farg['text'], opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text maxFontSizeMultiplier={1.3} style={[styles.klartext, { color: farg['bg'] }]}>
            Klar
          </Text>
        </Pressable>
      </View>
      <Vagform niva={niva} />
      <Text maxFontSizeMultiplier={1.6} style={[TEXT['secondary'], { color: farg['muted'] }]}>
        Inget skickas förrän du trycker Räkna.
      </Text>
    </Animated.View>
  );
}

/** Vy 40b: raden ovanför fältet i Rabbit AI. */
export function Lyssnarrad({
  niva,
  onKlar,
}: {
  readonly niva: number;
  readonly onKlar: () => void;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const tid = rorelse.reducerad ? REDUCERAD_MS : 150;
  return (
    <Animated.View
      entering={FadeIn.duration(tid)}
      exiting={FadeOut.duration(tid)}
      accessible
      accessibilityLabel="Lyssnar. Inget skickas förrän du trycker Skicka."
      style={styles.lyssnarrad}
    >
      <View style={[styles.punkt, { backgroundColor: farg['greenIcon'] }]} />
      <View style={styles.fyll}>
        <Vagform niva={niva} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Klar"
        onPress={onKlar}
        style={({ pressed }) => [
          styles.klar,
          { backgroundColor: farg['text'], opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text maxFontSizeMultiplier={1.3} style={[styles.klartext, { color: farg['bg'] }]}>
          Klar
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Vy 41: mikrofonen är avstängd, och beskedet när bygget saknar stödet.
 *
 * Skrivandet fungerar som vanligt i båda fallen — det är därför kortet aldrig
 * tar över skärmen, utan ligger ovanför fältet.
 */
export function Rostbesked({
  lage,
  onStang,
  onOppnaInstallningar,
}: {
  readonly lage: Rostlage;
  readonly onStang: () => void;
  readonly onOppnaInstallningar: () => void;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  if (lage !== 'nekad' && lage !== 'saknas' && lage !== 'fel') return null;

  const rubrik =
    lage === 'nekad'
      ? 'Mikrofonen är avstängd'
      : lage === 'saknas'
        ? 'Rösten fungerar i testappen'
        : 'Det gick inte att höra';
  const text =
    lage === 'nekad'
      ? 'Appen får inte använda mikrofonen. Slå på Mikrofon och Taligenkänning för TechRabbit Calc i iOS-inställningarna. Du kan skriva frågan som vanligt så länge.'
      : lage === 'saknas'
        ? 'Taligenkänningen är en del av appen och finns inte i Expo Go. Den fungerar i testappen och i den färdiga appen. Skriv frågan så länge.'
        : 'Taligenkänningen avbröts. Försök igen, eller skriv frågan.';

  return (
    <Animated.View
      entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
      exiting={FadeOut.duration(REDUCERAD_MS)}
      accessible
      accessibilityLabel={`${rubrik}. ${text}`}
      style={[styles.besked, { backgroundColor: farg['card'] }]}
    >
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.5}
        style={[styles.beskedrubrik, { color: farg['text'] }]}
      >
        {rubrik}
      </Text>
      <Text maxFontSizeMultiplier={1.7} style={[styles.beskedtext, { color: farg['muted'] }]}>
        {text}
      </Text>
      {lage === 'nekad' ? (
        <SekundarKnapp titel="Öppna Inställningar" onPress={onOppnaInstallningar} />
      ) : (
        <SekundarKnapp titel="Okej" onPress={onStang} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fyll: { flex: 1 },
  fyllut: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

  mik: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },

  vagform: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32 },
  stapel: { width: 3, borderRadius: 1.5 },

  lyssnarkort: { borderRadius: 20, padding: 16, gap: 12 },
  lyssnarrad: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  punkt: { width: 8, height: 8, borderRadius: 4 },
  lyssnartext: { fontSize: 14, fontFamily: 'Archivo_700Bold', includeFontPadding: false },
  klar: { height: 44, borderRadius: 22, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  klartext: { fontSize: 14, fontFamily: 'Archivo_800ExtraBold', includeFontPadding: false },

  besked: { borderRadius: 20, padding: 16, gap: 8 },
  beskedrubrik: { fontSize: 17, fontFamily: 'Archivo_900Black', includeFontPadding: false },
  beskedtext: { fontSize: 14, lineHeight: 20, fontFamily: 'Archivo_500Medium' },
});
