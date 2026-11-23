/**
 * De nya komponenterna i design v2: hopfällbar rad, villkorsrad, praktiskt
 * pris, resultatrad, redigerbart och härlett värde, valknapp och Skriv själv.
 *
 * Mått och typografi ur `design/tech-rabbit-utraknat-design-v2/komponenter/
 * KOMPONENTER.md`, rörelse ur `RORELSE-HAPTIK.md` i samma mapp.
 *
 * `inset` används aldrig för att skilja ett block från kortet det ligger i —
 * den är samma färg som `bg` i ljust läge. En linje i `border` i stället. Det
 * är den enda fällan KOMPONENTER.md pekar ut två gånger.
 */

import { useState, type ReactNode } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { KLAR_ID_ARK } from './Tangentbord';
import { useTema } from '../design/tema';
import { TEXT } from '../design/tokens';
import { REDUCERAD_MS, useRorelse, YTA_MS } from '../lib/rorelse';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Hopfällbar rad
// ---------------------------------------------------------------------------

/**
 * Rad som fälls ut. Min 58, radie 18, padding 14/16, chevron 18.
 *
 * Höjden animeras 200 ms och chevronen roterar 180° på samma tid. Med
 * reducerad rörelse: ingen rotation, bara en toning.
 */
export function Hopfallbar({
  etikett,
  sammanfattning,
  hoger,
  children,
  onOppna,
}: {
  readonly etikett: string;
  /** En rad med ellips, visas bara när raden är hopfälld. */
  readonly sammanfattning?: string;
  /** Text längst till höger, t.ex. "3 steg". */
  readonly hoger?: string;
  readonly children: ReactNode;
  readonly onOppna?: (oppen: boolean) => void;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const [oppen, setOppen] = useState(false);
  const vinkel = useSharedValue(0);

  const chevronstil = useAnimatedStyle(() => ({
    transform: [{ rotate: `${vinkel.value}deg` }],
  }));

  function vaxla(): void {
    const nytt = !oppen;
    if (!rorelse.reducerad) {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(YTA_MS, LayoutAnimation.Types.easeInEaseOut, 'opacity'),
      );
      vinkel.value = withTiming(nytt ? 180 : 0, rorelse.toning(YTA_MS));
    }
    setOppen(nytt);
    onOppna?.(nytt);
  }

  return (
    <View style={[styles.hopfallbar, { backgroundColor: farg['card'] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: oppen }}
        accessibilityLabel={etikett}
        accessibilityHint={oppen ? 'Fäller ihop' : 'Fäller ut'}
        onPress={vaxla}
        style={styles.hopfallbarRad}
      >
        <View style={styles.fyll}>
          <Text
            maxFontSizeMultiplier={1.5}
            style={[TEXT['sectionLabel'], styles.versal, { color: farg['muted'] }]}
          >
            {etikett}
          </Text>
          {!oppen && sammanfattning !== undefined && sammanfattning !== '' ? (
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.4}
              style={[TEXT['secondary'], styles.sammanfattning, { color: farg['muted'] }]}
            >
              {sammanfattning}
            </Text>
          ) : null}
        </View>
        {hoger !== undefined && hoger !== '' ? (
          <Text maxFontSizeMultiplier={1.4} style={[TEXT['secondary'], { color: farg['muted'] }]}>
            {hoger}
          </Text>
        ) : null}
        <Animated.View style={rorelse.reducerad ? null : chevronstil}>
          <Chevron farg={farg['muted'] ?? '#888'} ner={rorelse.reducerad ? !oppen : true} />
        </Animated.View>
      </Pressable>
      {oppen ? <View style={styles.hopfallbarInnehall}>{children}</View> : null}
    </View>
  );
}

function Chevron({ farg, ner }: { readonly farg: string; readonly ner: boolean }): ReactNode {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d={ner ? 'M6 9.5l6 6 6-6' : 'M6 14.5l6-6 6 6'}
        stroke={farg}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Villkorsrad
// ---------------------------------------------------------------------------

/**
 * Avgörande förutsättningar under talet, t.ex. "Om alla 260 säljs · efter
 * inköpskostnaden". 13/18 i `faint`, marginal 6. Visas bara när det finns
 * villkor — de får aldrig gömmas bara i "Så räknade jag".
 */
export function Villkorsrad({ villkor }: { readonly villkor: readonly string[] }): ReactNode {
  const { farg } = useTema();
  if (villkor.length === 0) return null;
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      style={[TEXT['secondary'], styles.villkor, { color: farg['faint'] }]}
    >
      {villkor.join(' · ')}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Uppslagna villkor (direktiv 32)
// ---------------------------------------------------------------------------

/** Ett värde tjänsten slog upp själv, med källa. */
export interface Uppslaget {
  readonly text: string;
  readonly kalla: string;
  readonly fraga: string;
  readonly varde: string;
  readonly enhet: string;
}

/**
 * Villkoret som går att rätta.
 *
 * Tjänsten slog upp värdet — restid, avstånd, bränslepris — och visar det
 * med sin källa. Ett uppslaget värde är ett antagande, så raden är tryckbar:
 * den öppnar ett fält med värdet ifyllt, och Räkna om skickar rättelsen som
 * ett vanligt följdsvar. Appen räknar aldrig själv.
 */
export function Uppslagsvillkor({
  uppslag,
  onRatta,
}: {
  readonly uppslag: readonly Uppslaget[];
  readonly onRatta: (fraga: string, varde: string) => void;
}): ReactNode {
  const { farg } = useTema();
  const [oppet, setOppet] = useState<string | null>(null);
  const [varde, setVarde] = useState('');
  if (uppslag.length === 0) return null;

  return (
    <View style={styles.uppslag}>
      {uppslag.map((u) => (
        <View key={u.fraga}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${u.text}. Tryck för att ändra värdet.`}
            onPress={() => {
              setVarde(u.varde);
              setOppet(oppet === u.fraga ? null : u.fraga);
            }}
            style={({ pressed }) => [
              styles.uppslagsrad,
              {
                backgroundColor: farg['inset'],
                borderColor: farg['controlBorder'],
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.5}
              style={[TEXT['secondary'], styles.fyll, { color: farg['muted'] }]}
            >
              {u.text}
            </Text>
            <Text maxFontSizeMultiplier={1.3} style={[TEXT['meta'], { color: farg['greenIcon'] }]}>
              {oppet === u.fraga ? 'Stäng' : 'Ändra'}
            </Text>
          </Pressable>

          {oppet === u.fraga ? (
            <View style={styles.uppslagsfalt}>
              <View
                style={[
                  styles.uppslagsruta,
                  { backgroundColor: farg['inset'], borderColor: farg['greenIcon'] },
                ]}
              >
                <TextInput
                  value={varde}
                  onChangeText={setVarde}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  inputAccessoryViewID={KLAR_ID_ARK}
                  autoFocus
                  accessibilityLabel={`${u.fraga} i ${u.enhet}`}
                  maxFontSizeMultiplier={1.4}
                  style={[TEXT['input'], styles.fyll, { color: farg['text'] }]}
                />
                <Text maxFontSizeMultiplier={1.3} style={[TEXT['meta'], { color: farg['muted'] }]}>
                  {u.enhet}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Räkna om"
                disabled={varde.trim() === ''}
                onPress={() => {
                  setOppet(null);
                  onRatta(u.fraga, varde.trim());
                }}
                style={({ pressed }) => [
                  styles.uppslagsknapp,
                  {
                    backgroundColor: varde.trim() === '' ? farg['track'] : farg['greenIcon'],
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={[
                    TEXT['meta'],
                    { color: varde.trim() === '' ? farg['faint'] : farg['onGreen'] },
                  ]}
                >
                  Räkna om
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Praktiskt pris
// ---------------------------------------------------------------------------

/**
 * Värdet som faktiskt uppfyller målet när avrundning krävs (F01).
 *
 * Linje över, padding-top 13. Tonas in MED resultatkortet, inte efteråt: det
 * är en del av svaret, inte ett tillägg.
 */
export function Praktisktpris({
  etikett,
  varde,
  enhet,
  skal,
}: {
  /** "Praktiskt pris" eller "Exakt" — samma rad, två betydelser. */
  readonly etikett: string;
  readonly varde: string;
  readonly enhet: string;
  readonly skal: string;
}): ReactNode {
  const { farg } = useTema();
  return (
    <View
      accessible
      accessibilityLabel={`${etikett}: ${varde} ${enhet}. ${skal}`}
      style={[styles.praktiskt, { borderTopColor: farg['border'] }]}
    >
      <View style={styles.praktisktRad}>
        <Text
          maxFontSizeMultiplier={1.4}
          style={[TEXT['sectionLabel'], styles.versal, styles.fyll, { color: farg['muted'] }]}
        >
          {etikett}
        </Text>
        <Text maxFontSizeMultiplier={1.3} style={[TEXT['sheetTitle'], { color: farg['text'] }]}>
          {varde}
        </Text>
        <Text maxFontSizeMultiplier={1.3} style={[TEXT['button'], styles.praktisktEnhet, { color: farg['muted'] }]}>
          {enhet}
        </Text>
      </View>
      <Text
        maxFontSizeMultiplier={1.6}
        style={[TEXT['secondary'], styles.praktisktSkal, { color: farg['muted'] }]}
      >
        {skal}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Resultatrad (flera svar)
// ---------------------------------------------------------------------------

/**
 * En rad per svar när frågan har flera, t.ex. ett pris per förpackning.
 * Höjd 49, avdelare i `border`. Raderna tonas in uppifrån och ned, 80 ms
 * mellan, och haptiken ges en gång för hela resultatet — inte per rad.
 */
export function Resultatrad({
  etikett,
  varde,
  enhet,
  forst,
  fordrojning,
}: {
  readonly etikett: string;
  readonly varde: string;
  readonly enhet: string;
  readonly forst: boolean;
  readonly fordrojning: number;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  return (
    <Animated.View
      entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS).delay(
        rorelse.reducerad ? 0 : fordrojning,
      )}
      accessible
      accessibilityLabel={`${etikett}: ${varde} ${enhet}`}
      style={[
        styles.resultatrad,
        forst
          ? null
          : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: farg['border'] },
      ]}
    >
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.4}
        style={[TEXT['rowTitle'], styles.fyll, { color: farg['muted'] }]}
      >
        {etikett}
      </Text>
      <Text maxFontSizeMultiplier={1.3} style={[TEXT['sheetTitle'], { color: farg['text'] }]}>
        {varde}
      </Text>
      <Text
        maxFontSizeMultiplier={1.3}
        style={[TEXT['button'], styles.praktisktEnhet, { color: farg['muted'] }]}
      >
        {enhet}
      </Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Redigerbart och härlett värde — vy 05b
// ---------------------------------------------------------------------------

/**
 * Ett värde som går att ändra. 40 hög, min bredd 86, radie 12, kant 1.5.
 * Kanten går till 2 i `greenIcon` vid fokus, på 100 ms. Värdet hoppar aldrig.
 */
export function Redigerbartvarde({
  etikett,
  varde,
  enhet,
  forst,
  onChange,
}: {
  readonly etikett: string;
  readonly varde: string;
  readonly enhet: string;
  readonly forst: boolean;
  readonly onChange: (v: string) => void;
}): ReactNode {
  const { farg } = useTema();
  const [fokus, setFokus] = useState(false);

  return (
    <View
      style={[
        styles.faktarad,
        forst ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: farg['border'] },
      ]}
    >
      <Text
        maxFontSizeMultiplier={1.4}
        style={[TEXT['rowTitle'], styles.fyll, { color: farg['text'] }]}
      >
        {etikett}
      </Text>
      <View
        style={[
          styles.falt,
          {
            backgroundColor: farg['inset'],
            borderColor: fokus ? farg['greenIcon'] : farg['controlBorder'],
            borderWidth: fokus ? 2 : 1.5,
          },
        ]}
      >
        <TextInput
          value={varde}
          onChangeText={onChange}
          onFocus={() => setFokus(true)}
          onBlur={() => setFokus(false)}
          keyboardType="decimal-pad"
          returnKeyType="done"
          inputAccessoryViewID={KLAR_ID_ARK}
          accessibilityLabel={`${etikett} i ${enhet}`}
          maxFontSizeMultiplier={1.4}
          style={[TEXT['input'], styles.faltvarde, { color: farg['text'] }]}
        />
        <Text maxFontSizeMultiplier={1.3} style={[TEXT['meta'], { color: farg['muted'] }]}>
          {enhet}
        </Text>
      </View>
      <Penna farg={farg['faint'] ?? '#999'} />
    </View>
  );
}

function Penna({ farg }: { readonly farg: string }): ReactNode {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d="M4 20h4L19 9l-4-4L4 16v4zM14.5 5.5l4 4"
        stroke={farg}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Ett värde motorn räknat fram ur de andra. Rad 48, linje över, märket
 * "härlett" med hänglås. Alltid låst, går inte att trycka på.
 *
 * Det räknas om med en toning på 200 ms när ett annat värde ändras. Det får
 * aldrig se ut som om användaren ändrade det.
 */
export function Harlettvarde({
  etikett,
  varde,
  enhet,
}: {
  readonly etikett: string;
  readonly varde: string;
  readonly enhet: string;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  return (
    <View
      accessible
      accessibilityLabel={`${etikett}: ${varde} ${enhet}. Härlett värde, går inte att ändra.`}
      style={[
        styles.harledd,
        { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: farg['border'] },
      ]}
    >
      <Text maxFontSizeMultiplier={1.4} style={[TEXT['rowTitle'], { color: farg['muted'] }]}>
        {etikett}
      </Text>
      <View style={[styles.marke, { borderColor: farg['border'] }]}>
        <Las farg={farg['muted'] ?? '#888'} />
        <Text maxFontSizeMultiplier={1.3} style={[TEXT['meta'], { color: farg['muted'] }]}>
          härlett
        </Text>
      </View>
      <View style={styles.fyll} />
      <Animated.Text
        key={`${varde} ${enhet}`}
        entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
        maxFontSizeMultiplier={1.4}
        style={[TEXT['input'], { color: farg['text'] }]}
      >
        {varde} {enhet}
      </Animated.Text>
    </View>
  );
}

function Las({ farg }: { readonly farg: string }): ReactNode {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d="M6 11h12v9H6zM9 11V7.5a3 3 0 016 0V11"
        stroke={farg}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Valknapp och Skriv själv — vy 04b
// ---------------------------------------------------------------------------

/**
 * Ett val vid tvetydighet. Min 62, radie 18, kant 1.5.
 *
 * **Inget val är förvalt.** Knapparna tonas in en i taget, 60 ms mellan, och
 * den valda får kant 2 i `greenIcon` på 100 ms innan vyn går vidare.
 */
export function Valknapp({
  titel,
  under,
  vald,
  ordning,
  onPress,
}: {
  readonly titel: string;
  readonly under: string;
  readonly vald: boolean;
  readonly ordning: number;
  readonly onPress: () => void;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  return (
    <Animated.View
      entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS).delay(
        rorelse.reducerad ? 0 : ordning * 60,
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: vald }}
        accessibilityLabel={under === '' ? titel : `${titel}. ${under}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.valknapp,
          {
            backgroundColor: farg['card'],
            borderColor: vald ? farg['greenIcon'] : farg['border'],
            borderWidth: vald ? 2 : 1.5,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text maxFontSizeMultiplier={1.6} style={[TEXT['rowTitle'], { color: farg['text'] }]}>
          {titel}
        </Text>
        {under === '' ? null : (
          <Text
            maxFontSizeMultiplier={1.6}
            style={[TEXT['secondary'], styles.valunder, { color: farg['faint'] }]}
          >
            {under}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** "Skriv själv": min 56, radie 18, streckad kant 1.5, 15/600 i `muted`. */
export function SkrivSjalv({
  ordning,
  onPress,
}: {
  readonly ordning: number;
  readonly onPress: () => void;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  return (
    <Animated.View
      entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS).delay(
        rorelse.reducerad ? 0 : ordning * 60,
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skriv själv"
        accessibilityHint="Svara med egna ord i stället för att välja"
        onPress={onPress}
        style={({ pressed }) => [
          styles.skrivSjalv,
          { borderColor: farg['controlBorder'], opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text maxFontSizeMultiplier={1.6} style={[TEXT['secondary'], { color: farg['muted'] }]}>
          Skriv själv
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fyll: { flex: 1 },
  versal: { textTransform: 'uppercase', letterSpacing: 0.6 },

  hopfallbar: { borderRadius: 18, overflow: 'hidden' },
  hopfallbarRad: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  hopfallbarInnehall: { paddingHorizontal: 16, paddingBottom: 14 },
  sammanfattning: { marginTop: 2 },

  villkor: { marginTop: 6 },
  uppslag: { marginTop: 8, gap: 8 },
  uppslagsrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  uppslagsfalt: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  uppslagsruta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 12,
  },
  uppslagsknapp: {
    minHeight: 48,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
  },

  praktiskt: { marginTop: 13, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth },
  praktisktRad: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  praktisktEnhet: { marginLeft: 2 },
  praktisktSkal: { marginTop: 4 },

  resultatrad: {
    minHeight: 49,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingVertical: 11,
  },

  faktarad: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  falt: {
    minWidth: 86,
    height: 40,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    paddingHorizontal: 12,
  },
  faltvarde: { minWidth: 34, textAlign: 'right', padding: 0 },

  harledd: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  marke: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },

  valknapp: { minHeight: 62, borderRadius: 18, justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  valunder: { marginTop: 3 },
  skrivSjalv: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
