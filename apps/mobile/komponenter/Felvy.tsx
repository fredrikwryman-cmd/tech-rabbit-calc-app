/**
 * Felvyerna 06a–06f.
 *
 * 06a och 06b följer design v3.1 (`design/tech-rabbit-calc-design-v3.1/vyer/`).
 * 06c–06f finns bara i v2 och följer den: `design/tech-rabbit-utraknat-design-v2/`.
 *
 * KOMPONENTER.md: ikon 64 i warnSoft, rubrik 30/36 vikt 900, text 16/23.
 * RORELSE-HAPTIK.md vy 06: toning 200 ms, felet läses upp av VoiceOver, kort
 * varning i haptiken (vyn som visar felet sköter haptiken).
 *
 * Två regler ur v2:s KOMPONENTER.md styr vad som syns:
 *   - Frågan ligger alltid kvar. Den ritas av vyn som visar felvyn.
 *   - Knappar visas bara när de behövs. "Försök igen" finns inte på ett fel
 *     som inte går att försöka igen på.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { useTema } from '../design/tema';
import { TEXT } from '../design/tokens';
import { REDUCERAD_MS, useRorelse, YTA_MS } from '../lib/rorelse';
import type { Feltyp } from '../lib/tolkning';

/** De sex felvyerna. Samma nycklar som filnamnen i `design/`. */
export type Felvysort = '06a' | '06b' | '06c' | '06d' | '06e' | '06f';

/**
 * Vilken vy en feltyp hamnar i.
 *
 * `ingen-anslutning` är appens eget: servern kan inte svara på ett anrop som
 * aldrig kom fram. De övriga kommer från servern (F10 i kontrakt.ts).
 */
export function felvysortFor(typ: Feltyp | undefined): Felvysort {
  switch (typ) {
    case 'ingen-anslutning':
      return '06a';
    case 'server':
      return '06b';
    case 'rate_limited':
      return '06c';
    case 'unsupported':
      return '06e';
    case 'invalid_input':
      return '06f';
    default:
      return '06d';
  }
}

/** Går felet att försöka igen på? Styr vilka knappar vyn visar. */
export function garAttForsokaIgen(sort: Felvysort): boolean {
  // 06e: räkningen finns inte. 06f: uppgifterna motsäger varandra. Att trycka
  // "Försök igen" på dem leder tillbaka till samma svar.
  return sort !== '06e' && sort !== '06f';
}

const TEXTER: Readonly<Record<Felvysort, { rubrik: string; text: string }>> = {
  '06a': {
    rubrik: 'Ingen anslutning',
    text: 'Frågan är kvar. Kontrollera wifi eller mobildata och försök igen.',
  },
  '06b': {
    rubrik: 'Tillfälligt serverfel',
    text: 'Något gick fel hos oss, inte hos dig. Frågan är kvar — försök igen om en stund.',
  },
  '06c': {
    rubrik: 'För många frågor',
    text: 'Frågan är kvar. Vänta en liten stund och försök igen.',
  },
  '06d': {
    rubrik: 'Kunde inte tolka frågan',
    text: 'Skriv vad du vet och vad du vill få fram. Till exempel pris, mängd och vad som ska räknas ut.',
  },
  '06e': {
    rubrik: 'Det här kan jag inte räkna än',
    text: 'Jag förstod frågan, men har ingen räkning för den. Prova en annan fråga.',
  },
  '06f': {
    rubrik: 'Uppgifterna går inte ihop',
    text: 'Talen motsäger varandra, så räkningen går inte att göra. Ändra en uppgift och försök igen.',
  },
};

// ---------------------------------------------------------------------------
// Ikoner
// ---------------------------------------------------------------------------

function IkonIngenAnslutning({ farg }: { readonly farg: string }): ReactNode {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 9.5A14 14 0 0 1 19.5 9.5M7.5 13A9 9 0 0 1 16.5 13M10.4 16.4A4 4 0 0 1 13.6 16.4"
        stroke={farg}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={19.4} r={1.2} fill={farg} />
      <Line x1={3.5} y1={3.5} x2={20.5} y2={20.5} stroke={farg} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Moln med utropstecken: felet ligger hos servern, inte hos användaren. */
function IkonServerfel({ farg }: { readonly farg: string }): ReactNode {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 18.5h9.5a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 7.6 10 3.8 3.8 0 0 0 7 18.5z"
        stroke={farg}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Line x1={12} y1={9} x2={12} y2={13} stroke={farg} strokeWidth={2.2} strokeLinecap="round" />
      <Circle cx={12} cy={15.6} r={1.1} fill={farg} />
    </Svg>
  );
}

/** Klocka: rätt handling är att vänta. */
function IkonVanta({ farg }: { readonly farg: string }): ReactNode {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} stroke={farg} strokeWidth={2} />
      <Path d="M12 7.2V12l3.2 2" stroke={farg} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IkonKundeInteTolka({ farg }: { readonly farg: string }): ReactNode {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.8 8.8a3.3 3.3 0 1 1 4.4 3.1c-.9.3-1.2 1-1.2 1.9v.7"
        stroke={farg}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={18.3} r={1.3} fill={farg} />
    </Svg>
  );
}

/** Överstruken miniräknare: räkningen finns inte. */
function IkonKanInteRakna({ farg }: { readonly farg: string }): ReactNode {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Rect x={5.5} y={3.5} width={13} height={17} rx={2.5} stroke={farg} strokeWidth={2} />
      <Line x1={8.5} y1={8} x2={15.5} y2={8} stroke={farg} strokeWidth={2} strokeLinecap="round" />
      <Line x1={3.5} y1={3.5} x2={20.5} y2={20.5} stroke={farg} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Två pilar som möts: uppgifterna motsäger varandra. */
function IkonGarInteIhop({ farg }: { readonly farg: string }): ReactNode {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 8.5h7m-2.5-3 3 3-3 3M20.5 15.5h-7m2.5-3-3 3 3 3"
        stroke={farg}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Ikon({ sort, farg }: { readonly sort: Felvysort; readonly farg: string }): ReactNode {
  switch (sort) {
    case '06a':
      return <IkonIngenAnslutning farg={farg} />;
    case '06b':
      return <IkonServerfel farg={farg} />;
    case '06c':
      return <IkonVanta farg={farg} />;
    case '06e':
      return <IkonKanInteRakna farg={farg} />;
    case '06f':
      return <IkonGarInteIhop farg={farg} />;
    default:
      return <IkonKundeInteTolka farg={farg} />;
  }
}

// ---------------------------------------------------------------------------
// Väntetiden i 06c
// ---------------------------------------------------------------------------

/**
 * Nedräkningen i 06c.
 *
 * RORELSE-HAPTIK.md v2: tiden räknas ned i text, en gång i sekunden, ingen
 * animerad ring. Varningen ges en gång, inte per sekund — den ges av vyn som
 * visar felet, inte här.
 *
 * Finns ingen `retryAfter` visas ingen väntetid alls: att hitta på en siffra
 * vore värre än att låta bli.
 */
function Vantetid({ sekunder }: { readonly sekunder: number }): ReactNode {
  const { farg } = useTema();
  const [kvar, setKvar] = useState(Math.max(0, Math.ceil(sekunder)));

  useEffect(() => {
    setKvar(Math.max(0, Math.ceil(sekunder)));
    const klocka = setInterval(() => {
      setKvar((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => clearInterval(klocka);
  }, [sekunder]);

  return (
    <Text
      maxFontSizeMultiplier={1.8}
      // Siffran byts varje sekund; den ska inte läsas upp varje gång.
      accessibilityLiveRegion="none"
      style={[TEXT['body'], { color: farg['muted'] }]}
    >
      {kvar > 0 ? `Försök igen om ${kvar} sekunder.` : 'Du kan försöka igen nu.'}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// "Menade du?" i 06d
// ---------------------------------------------------------------------------

/**
 * Ett förslagskort. Tryck räknar frågan direkt.
 *
 * KOMPONENTER.md v2: min 54, radie 18, padding 14/16, pil 17, fråga 15/600,
 * pilen i greenText. Korten tonas in ett i taget, 60 ms mellan, efter rubriken.
 *
 * Förslagen har redan provats mot räknemotorn på servern, så ett tryck leder
 * aldrig tillbaka till samma fel.
 */
function Forslagskort({
  fraga,
  ordning,
  onPress,
}: {
  readonly fraga: string;
  readonly ordning: number;
  readonly onPress: () => void;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  return (
    <Animated.View
      entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS).delay(
        rorelse.reducerad ? 0 : 120 + ordning * 60,
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fraga}
        accessibilityHint="Räknar den här frågan"
        onPress={onPress}
        style={({ pressed }) => [
          styles.forslag,
          { backgroundColor: farg['card'], opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text maxFontSizeMultiplier={1.6} style={[TEXT['secondary'], styles.fyll, { color: farg['text'] }]}>
          {fraga}
        </Text>
        <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 12h13m-5.5-5.5L18 12l-5.5 5.5"
            stroke={farg['greenText']}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Felvyn
// ---------------------------------------------------------------------------

export interface FelvyProps {
  readonly sort: Felvysort;
  /** Ersätter standardtexten när tjänsten har något ärligare att säga. */
  readonly meddelande?: string;
  /** Sekunder till nästa försök. Utan den visas ingen väntetid (06c). */
  readonly retryAfter?: number;
  /** "Menade du?" — omformuleringar servern redan provat (06d). */
  readonly forslag?: readonly string[];
  /** Tryck på ett förslag räknar det direkt. */
  readonly onForslag?: (fraga: string) => void;
  readonly knappar: ReactNode;
}

export function Felvy({
  sort,
  meddelande,
  retryAfter,
  forslag,
  onForslag,
  knappar,
}: FelvyProps): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const { rubrik } = TEXTER[sort];
  const text = meddelande !== undefined && meddelande !== '' ? meddelande : TEXTER[sort].text;
  const visaForslag = sort === '06d' && (forslag?.length ?? 0) > 0 && onForslag !== undefined;

  // Felet läses upp även om fokus ligger kvar någon annanstans.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${rubrik}. ${text}`);
  }, [rubrik, text]);

  return (
    <Animated.View
      entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
      style={styles.rot}
    >
      <View style={styles.mitt}>
        <View style={[styles.ikon, { backgroundColor: farg['warnSoft'] }]}>
          <Ikon sort={sort} farg={farg['warnText'] ?? '#000'} />
        </View>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.5}
          style={[TEXT['screenTitle'], styles.rubrik, { color: farg['text'] }]}
        >
          {rubrik}
        </Text>
        <Text maxFontSizeMultiplier={1.8} style={[TEXT['body'], { color: farg['muted'] }]}>
          {text}
        </Text>

        {sort === '06c' && retryAfter !== undefined ? <Vantetid sekunder={retryAfter} /> : null}

        {visaForslag ? (
          <View style={styles.forslagsspalt}>
            <Text
              maxFontSizeMultiplier={1.5}
              style={[TEXT['sectionLabel'], styles.versal, { color: farg['muted'] }]}
            >
              Menade du?
            </Text>
            {(forslag ?? []).slice(0, 3).map((f, i) => (
              <Forslagskort key={f} fraga={f} ordning={i} onPress={() => onForslag?.(f)} />
            ))}
          </View>
        ) : null}
      </View>
      <View style={styles.knappar}>{knappar}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rot: { flex: 1, justifyContent: 'space-between' },
  fyll: { flex: 1 },
  mitt: { flex: 1, justifyContent: 'center', gap: 12 },
  ikon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  rubrik: { marginTop: 8 },
  versal: { textTransform: 'uppercase', letterSpacing: 0.6 },
  forslagsspalt: { gap: 8, marginTop: 10 },
  forslag: {
    minHeight: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  knappar: { gap: 12, paddingBottom: 12 },
});
