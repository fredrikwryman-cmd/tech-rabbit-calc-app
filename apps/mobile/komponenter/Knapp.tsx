/**
 * Knapparna: primär, sekundär och destruktiv.
 *
 * KOMPONENTER.md: höjd 52, pill, 17/800. Nedtryckt är skala 0,97 på 100 ms.
 * Inaktiv primärknapp är track/faint. Laddar byter texten — aldrig en evig
 * spinner.
 */

import { useId, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTema } from '../design/tema';
import { TEXT } from '../design/tokens';
import { TRYCK_MS, useRorelse } from '../lib/rorelse';

const HOJD = 52;

export interface KnappProps {
  readonly titel: string;
  readonly onPress: () => void;
  readonly inaktiv?: boolean;
  /** Texten som visas i stället för titeln medan något pågår. */
  readonly laddarText?: string;
  readonly laddar?: boolean;
  /** Ikon till vänster om texten, t.ex. papperskorgen i Rensa historik. */
  readonly ikon?: ReactNode;
  readonly style?: ViewStyle;
  readonly testID?: string;
}

interface YtaProps extends KnappProps {
  readonly sort: 'primar' | 'sekundar' | 'destruktiv';
}

function Knappyta(props: YtaProps): ReactNode {
  const { titel, onPress, inaktiv, laddar, laddarText, ikon, style, sort, testID } = props;
  const { farg } = useTema();
  const rorelse = useRorelse();
  const skala = useSharedValue(1);

  /**
   * Knappens uppmätta yta, för den gröna gradienten.
   *
   * Lagret ritades förut som `<Svg style={StyleSheet.absoluteFill}
   * width="100%" height="100%">` med en `Rect` i procent. En Svg utan
   * viewBox har ingen egen koordinatrymd att räkna procenten mot, så
   * måtten löstes mot något annat än knappen: ytan blev ungefär 88 % bred,
   * förskjuten åt vänster och uppåt, med sned vänsterkant — sett på
   * telefonen i direktiv 27. Texten satt rätt hela tiden, för den ligger i
   * knappens riktiga yta.
   *
   * Nu mäts knappen med onLayout och gradienten ritas i PUNKTER: samma
   * bredd, samma höjd, samma radie. Före första mätningen ligger en solid
   * grön yta där, så knappen aldrig är tom en bildruta.
   */
  const [matt, setMatt] = useState({ bredd: 0, hojd: 0 });
  const matUpp = (e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    const bredd = Math.round(width);
    const hojd = Math.round(height);
    if (bredd !== matt.bredd || hojd !== matt.hojd) setMatt({ bredd, hojd });
  };

  /**
   * Gradientens id måste vara unikt per knapp.
   *
   * Två Svg-dokument med samma id på samma skärm kan dela definition i
   * react-native-svg, och då får båda knapparna den förstas färger.
   */
  const gradientId = `knapp-${useId().replace(/[^a-zA-Z0-9]/gu, '')}`;

  const av = inaktiv === true || laddar === true;
  const text = laddar === true && laddarText !== undefined ? laddarText : titel;

  const animerad = useAnimatedStyle(() => ({ transform: [{ scale: skala.value }] }));

  const textfarg =
    sort === 'primar'
      ? av
        ? farg['faint']
        : farg['onGreen']
      : sort === 'destruktiv'
        ? farg['burn']
        : farg['text'];

  const ram: ViewStyle =
    sort === 'sekundar'
      ? { backgroundColor: farg['card'], borderWidth: 1.5, borderColor: farg['controlBorder'] }
      : sort === 'destruktiv'
        ? { backgroundColor: farg['burnSoft'] }
        : av
          ? { backgroundColor: farg['track'] }
          : {};

  return (
    <Animated.View style={[styles.ytter, animerad, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityState={{ disabled: av, busy: laddar === true }}
        disabled={av}
        testID={testID}
        onPressIn={() => {
          skala.value = withTiming(rorelse.tryckskala, { duration: TRYCK_MS });
        }}
        onPressOut={() => {
          skala.value = withTiming(1, { duration: TRYCK_MS });
        }}
        onPress={onPress}
        onLayout={matUpp}
        style={[styles.yta, ram]}
      >
        {sort === 'primar' && !av ? (
          matt.bredd > 0 && matt.hojd > 0 ? (
            <Svg style={styles.lager} width={matt.bredd} height={matt.hojd}>
              <Defs>
                {/*
                  userSpaceOnUse: slutpunkten är knappens bredd i punkter,
                  inte en andel av en rymd som inte finns.
                */}
                <LinearGradient
                  id={gradientId}
                  x1={0}
                  y1={0}
                  x2={matt.bredd}
                  y2={0}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor={farg['greenFrom']} />
                  <Stop offset="1" stopColor={farg['greenTo']} />
                </LinearGradient>
              </Defs>
              <Rect
                x={0}
                y={0}
                width={matt.bredd}
                height={matt.hojd}
                rx={matt.hojd / 2}
                fill={`url(#${gradientId})`}
              />
            </Svg>
          ) : (
            // Före första mätningen: solid grön, aldrig en tom knapp.
            <View style={[styles.lager, styles.fyll, { backgroundColor: farg['greenTo'] }]} />
          )
        ) : null}
        <View style={styles.rad}>
          {ikon}
          <Text
            maxFontSizeMultiplier={1.6}
            style={[TEXT['button'], styles.text, { color: textfarg }]}
            numberOfLines={2}
          >
            {text}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function PrimarKnapp(props: KnappProps): ReactNode {
  return <Knappyta {...props} sort="primar" />;
}

export function SekundarKnapp(props: KnappProps): ReactNode {
  return <Knappyta {...props} sort="sekundar" />;
}

export function DestruktivKnapp(props: KnappProps): ReactNode {
  return <Knappyta {...props} sort="destruktiv" />;
}

/**
 * Den lilla sekundarknappen i resultatvyn (Dela).
 *
 * KOMPONENTER.md: hojd 40, radie 20, padding 0/20, 15/800, card med 1,5 pt
 * controlBorder. Den ar inte full bredd: den star pa rad med textknappen.
 */
export function LitenKnapp({
  titel,
  onPress,
  ikon,
}: {
  readonly titel: string;
  readonly onPress: () => void;
  readonly ikon?: ReactNode;
}): ReactNode {
  const { farg } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.liten,
        {
          backgroundColor: farg['card'],
          borderColor: farg['controlBorder'],
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {ikon}
      <Text maxFontSizeMultiplier={1.5} style={[styles.litentext, { color: farg['text'] }]}>
        {titel}
      </Text>
    </Pressable>
  );
}

/** Den underordnade handlingen: bara text (Ny fraga). 15/600 i muted. */
export function Textknapp({
  titel,
  onPress,
}: {
  readonly titel: string;
  readonly onPress: () => void;
}): ReactNode {
  const { farg } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titel}
      onPress={onPress}
      // Traffytan ar 44 hog aven om texten ar 20: GV-04 galler ocksa i appen.
      hitSlop={12}
      style={({ pressed }) => [styles.textknapp, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text maxFontSizeMultiplier={1.5} style={[styles.textknappstext, { color: farg['muted'] }]}>
        {titel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Lagret ligger i knappens översta vänstra hörn och får sina mått i punkter.
  lager: { position: 'absolute', left: 0, top: 0 },
  fyll: { right: 0, bottom: 0 },
  // Knappen ar full bredd enligt KOMPONENTER.md. Utan alignSelf kryper den
  // ihop till textens bredd sa fort nagon foralder centrerar sina barn.
  ytter: { alignSelf: 'stretch' },
  yta: {
    // minHeight i stället för height: knappen växer med Dynamic Type.
    minHeight: HOJD,
    borderRadius: HOJD / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  rad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  liten: {
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  litentext: { fontSize: 15, fontFamily: 'Archivo_800ExtraBold', includeFontPadding: false },
  textknapp: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  textknappstext: { fontSize: 15, fontFamily: 'Archivo_600SemiBold', includeFontPadding: false },
  /**
   * Knapptexten har INGEN uttrycklig radhojd.
   *
   * Direktiv 12 satte radhojden till teckengraden x 1,2 (20 pt vid 17) for att
   * centrera glyfen. Archivo ExtraBold ar ungefar 20,4 pt hog vid 17 pt, sa
   * radhojden hamnade strax UNDER teckensnittets egen. iOS skjuter da ned
   * baslinjen i radrutan, och texten gick utanfor knappens nederkant —
   * sett pa telefonen i "Rakna nagot" (direktiv 15).
   *
   * Utan radhojd far texten sitt naturliga matt och centreras av knappens
   * justifyContent. Archivos ruta har ungefar 0,6 pt mer luft ovanfor
   * versalerna an under baslinjen vid 17 pt; det ar mindre an en bildpunkt
   * och mycket mindre an klippningen. includeFontPadding och
   * textAlignVertical galler Android.
   */
  text: {
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
});
