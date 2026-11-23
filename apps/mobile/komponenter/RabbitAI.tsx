/**
 * Rabbit AI: vy 21, 21b, 21c-1, 21c-2, 21d, 21e och 21f (design v4).
 *
 * Skalet är nytt i v4. Maskineriet — lib/chatt.ts, strömningen, Stoppa,
 * dagsgränsen och de sparade samtalen — är detsamma som i direktiv 13.
 *
 * Skillnaden mot v3: frågan är en bubbla till höger i greenSoft, svaret står
 * till vänster med kaninsymbolen bredvid och en Kopiera-rad under, och de
 * tidigare samtalen ligger i en panel som glider in från vänster i stället för
 * under Historik.
 *
 * Rabbit AI räknar aldrig själv. En räknefråga ger ett kort svar utan tal och
 * kortet "Räkna på det", som flyttar frågan till Räkna (21d).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInLeft,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '../design/tema';
import { KLAR_ID_CHAT, KLAR_ID_PANEL, Klarrad } from './Tangentbord';
import { TEXT } from '../design/tokens';
import { samtalsrubrik, tidKvar, type Kalla, type Meddelande, type Samtal } from '../lib/chatt';
import { visaDatum } from '../lib/lagring';
import { REDUCERAD_MS, SKARM_MS, useHaptik, useRorelse, YTA_MS } from '../lib/rorelse';
import { useRost } from '../lib/rost';

import { Bekraftelsedialog } from './Dialog';
import { IkonRabbitAI } from './Ikoner';
import { SekundarKnapp } from './Knapp';
import { Lyssnarrad, Mikrofonknapp, Rostbesked } from './Rost';
import { Svepbar } from './Svepbar';

/** Förslagskorten i välkomstvyn (21). Exakt de tre som står i designen. */
const FORSLAG: readonly { readonly kategori: string; readonly fraga: string }[] = [
  { kategori: 'Vardag', fraga: 'Hur tar jag bort en kaffefläck från en vit skjorta?' },
  { kategori: 'Kunskap', fraga: 'Förklara kort hur en elbil fungerar' },
  { kategori: 'Idéer', fraga: 'Ge mig tre snabba middagar med kyckling' },
];

export interface RabbitAIProps {
  readonly meddelanden: readonly Meddelande[];
  /** Texten som strömmar just nu. Tom sträng = 21c-1 (tänker). */
  readonly strommar: string | null;
  /** Sant medan modellen slår upp något på webben (21c-1). */
  readonly soker: boolean;
  /** Dagens frågor är slut (21e). Sekunder till midnatt, eller 0. */
  readonly slutOm: number | null;
  readonly utkast: string;
  readonly onUtkast: (v: string) => void;
  /** Skickar utkastet, eller texten som skickas med (förslagskorten). */
  readonly onSkicka: (text?: string) => void;
  readonly onStoppa: () => void;
  readonly onNyttSamtal: () => void;
  readonly onRaknaPa: (fraga: string) => void;
  readonly onBytTillRakna: () => void;
  /** 21f: de sparade samtalen, nyast först. */
  readonly samtal: readonly Samtal[];
  readonly onOppnaSamtal: (s: Samtal) => void;
  readonly onRensaSamtal: () => void;
  /** Svep åt vänster på en rad i 21f tar bort just det samtalet. */
  readonly onTaBortSamtal: (id: string) => void;
  /** Id:t på samtalet som visas, så att raden kan märkas som vald. */
  readonly aktivtSamtal: string;
}

export function RabbitAI(props: RabbitAIProps): ReactNode {
  const {
    meddelanden,
    strommar,
    soker,
    slutOm,
    utkast,
    onUtkast,
    onSkicka,
    onStoppa,
    onNyttSamtal,
    onRaknaPa,
    onBytTillRakna,
    samtal,
    onOppnaSamtal,
    onRensaSamtal,
    onTaBortSamtal,
    aktivtSamtal,
  } = props;
  const { farg } = useTema();
  const rorelse = useRorelse();
  const haptik = useHaptik();
  const insets = useSafeAreaInsets();
  const traden = useRef<ScrollViewInstance>(null);
  const [langstNed, setLangstNed] = useState(true);
  const [panelen, setPanelen] = useState(false);
  /** Rösten (vy 40b och 41). Texten landar i kompositören, inget skickas. */
  const rost = useRost({ onText: onUtkast });

  const aktivt = strommar !== null;
  const avstangt = slutOm !== null;
  const kanSkicka = utkast.trim() !== '' && !aktivt && !avstangt;
  const tomt = meddelanden.length === 0 && !aktivt && !avstangt;

  // Tråden följer med nedåt bara om användaren redan är längst ned.
  useEffect(() => {
    if (langstNed) traden.current?.scrollToEnd({ animated: !rorelse.reducerad });
  }, [meddelanden.length, strommar, langstNed, rorelse.reducerad]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.fyll}
    >
      {/* Huvudet, 52 högt: meny, namn och penna för nytt samtal. */}
      <View style={styles.huvud}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tidigare samtal"
          accessibilityState={{ expanded: panelen }}
          onPress={() => setPanelen(true)}
          style={({ pressed }) => [styles.huvudknapp, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 7h16M4 12h12M4 17h8"
              stroke={farg['text']}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>

        <View style={styles.huvudmitt}>
          <IkonRabbitAI
            storlek={22}
            farg={farg['text'] ?? '#000'}
            detalj={farg['greenIcon'] ?? '#1ED63C'}
            gnista={farg['greenIcon'] ?? '#1ED63C'}
          />
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={1.4}
            style={[styles.huvudnamn, { color: farg['text'] }]}
          >
            Rabbit AI
          </Text>
          <View style={[styles.marke, { backgroundColor: farg['greenSoft'] }]}>
            <Text maxFontSizeMultiplier={1.3} style={[styles.marketext, { color: farg['onGreenSoft'] }]}>
              Gratis
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nytt samtal"
          onPress={() => {
            haptik('latt');
            onNyttSamtal();
          }}
          style={({ pressed }) => [styles.huvudknapp, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M16.5 3.8 20.2 7.5 8.8 18.9 4.3 19.7 5.1 15.2z"
              stroke={farg['text']}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>

      {tomt ? (
        <Valkomst onForslag={(f) => onSkicka(f)} />
      ) : (
        <ScrollView
          ref={traden}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.trad}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            setLangstNed(contentOffset.y + layoutMeasurement.height >= contentSize.height - 40);
          }}
          scrollEventThrottle={64}
        >
          {meddelanden.map((m, i) =>
            m.roll === 'jag' ? (
              <Bubbla key={`${i}-${m.text.slice(0, 12)}`} text={m.text} />
            ) : (
              <Svar
                key={`${i}-${m.text.slice(0, 12)}`}
                text={m.text}
                stoppat={m.stoppat === true}
                strommar={false}
                {...(m.raknaPa !== undefined
                  ? { raknaPa: m.raknaPa, onRaknaPa: () => onRaknaPa(m.raknaPa as string) }
                  : {})}
                {...(m.kallor !== undefined && m.kallor.length > 0 ? { kallor: m.kallor } : {})}
              />
            ),
          )}

          {/* 21c-1: tänker. 21c-2: svaret skrivs fram. */}
          {strommar === '' ? <Tanker soker={soker} /> : null}
          {strommar !== null && strommar !== '' ? (
            <Svar text={strommar} stoppat={false} strommar />
          ) : null}

          {/* 21e: dagens frågor är slut. */}
          {avstangt ? <Gransbesked sekunder={slutOm} onBytTillRakna={onBytTillRakna} /> : null}
        </ScrollView>
      )}

      {/* 41 och beskedet om testappen, ovanför kompositören. */}
      <Rostbesked
        lage={rost.lage}
        onStang={rost.nollstall}
        onOppnaInstallningar={rost.oppnaInstallningar}
      />

      {/* 40b: vågformen och Klar ligger ovanför fältet. */}
      {rost.lage === 'lyssnar' ? <Lyssnarrad niva={rost.niva} onKlar={rost.stoppa} /> : null}

      {/* Kompositören ligger fast ovanför tabbaren och följer tangentbordet. */}
      <View style={styles.kompositor}>
        <View
          style={[
            styles.falt,
            {
              backgroundColor: farg['card'],
              borderColor: rost.lage === 'lyssnar' ? farg['greenIcon'] : farg['controlBorder'],
              borderWidth: rost.lage === 'lyssnar' ? 2 : 1.5,
              opacity: avstangt ? 0.5 : 1,
            },
          ]}
        >
          <TextInput
            value={utkast}
            onChangeText={onUtkast}
            editable={!avstangt}
            placeholder={avstangt ? 'Dagens frågor är slut' : 'Fråga Rabbit AI …'}
            inputAccessoryViewID={KLAR_ID_CHAT}
            placeholderTextColor={farg['faint']}
            multiline
            accessibilityLabel="Din fråga"
            maxFontSizeMultiplier={1.6}
            style={[styles.falttext, styles.fyll, { color: farg['text'] }]}
          />
          {avstangt ? null : (
            <Mikrofonknapp
              lage={rost.lage}
              storlek={38}
              onStarta={rost.starta}
              onStoppa={rost.stoppa}
            />
          )}
        </View>

        {aktivt ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stoppa svaret"
            onPress={onStoppa}
            style={({ pressed }) => [
              styles.rund,
              { backgroundColor: farg['text'], opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Rect x={6} y={6} width={12} height={12} rx={2} fill={farg['bg']} />
            </Svg>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skicka frågan"
            accessibilityState={{ disabled: !kanSkicka }}
            disabled={!kanSkicka}
            onPress={() => {
              haptik('latt');
              Keyboard.dismiss();
              onSkicka();
            }}
            style={({ pressed }) => [
              styles.rund,
              {
                backgroundColor: kanSkicka ? farg['greenIcon'] : farg['track'],
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 19V5.5M5.5 12 12 5.5 18.5 12"
                stroke={kanSkicka ? farg['onGreen'] : farg['faint']}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        )}
      </View>

      {/* 21f: tidigare samtal. */}
      <Samtalspanel
        oppen={panelen}
        samtal={samtal}
        aktivt={aktivtSamtal}
        overkant={insets.top}
        underkant={insets.bottom}
        onStang={() => setPanelen(false)}
        onOppna={(s) => {
          setPanelen(false);
          onOppnaSamtal(s);
        }}
        onRensa={() => {
          haptik('varning');
          onRensaSamtal();
        }}
        onTaBort={onTaBortSamtal}
      />
      {/* Chattens Klar-rad: stanger tangentbordet utan att skicka. */}
      <Klarrad id={KLAR_ID_CHAT} />
    </KeyboardAvoidingView>
  );
}

/** 21: välkomstvyn med de tre förslagskorten. */
function Valkomst({ onForslag }: { readonly onForslag: (f: string) => void }): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const haptik = useHaptik();
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.valkomst}>
      <Animated.View
        entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
        style={styles.valkomstspalt}
      >
        <IkonRabbitAI
          storlek={48}
          farg={farg['text'] ?? '#000'}
          detalj={farg['greenIcon'] ?? '#1ED63C'}
          gnista={farg['greenIcon'] ?? '#1ED63C'}
        />
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
          style={[TEXT['largeTitle'], { color: farg['text'] }]}
        >
          Hej! Vad undrar du?
        </Text>
        <Text maxFontSizeMultiplier={1.7} style={[styles.underrad, { color: farg['muted'] }]}>
          Fråga om vad som helst. Rabbit AI ingår gratis.
        </Text>

        <View style={styles.forslagspalt}>
          {FORSLAG.map((f) => (
            <Pressable
              key={f.fraga}
              accessibilityRole="button"
              accessibilityLabel={`${f.kategori}. ${f.fraga}`}
              accessibilityHint="Skickar frågan till Rabbit AI"
              onPress={() => {
                haptik('latt');
                Keyboard.dismiss();
                onForslag(f.fraga);
              }}
              style={({ pressed }) => [
                styles.forslagkort,
                {
                  backgroundColor: farg['card'],
                  transform: [{ scale: pressed ? rorelse.tryckskala : 1 }],
                },
              ]}
            >
              <View style={styles.fyll}>
                <Text
                  maxFontSizeMultiplier={1.4}
                  style={[styles.kategori, { color: farg['greenText'] }]}
                >
                  {f.kategori.toUpperCase()}
                </Text>
                <Text maxFontSizeMultiplier={1.6} style={[styles.forslagfraga, { color: farg['text'] }]}>
                  {f.fraga}
                </Text>
              </View>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 19V5.5M5.5 12 12 5.5 18.5 12"
                  stroke={farg['muted']}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

/** 21b: frågan som bubbla till höger. */
function Bubbla({ text }: { readonly text: string }): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  return (
    <Animated.View
      entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
      style={styles.bubbelrad}
    >
      <View style={[styles.bubbla, { backgroundColor: farg['greenSoft'] }]}>
        <Text maxFontSizeMultiplier={1.6} style={[styles.bubbeltext, { color: farg['onGreenSoft'] }]}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * 21b/21c-2: svaret till vänster med kaninsymbolen bredvid.
 *
 * VoiceOver annonserar svaret när det är KLART, aldrig medan det strömmar —
 * annars läses halva meningar om och om igen.
 */
function Svar({
  text,
  stoppat,
  strommar,
  raknaPa,
  onRaknaPa,
  kallor,
}: {
  readonly text: string;
  readonly stoppat: boolean;
  readonly strommar: boolean;
  readonly raknaPa?: string;
  readonly onRaknaPa?: () => void;
  readonly kallor?: readonly Kalla[];
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();

  useEffect(() => {
    if (strommar || text.trim() === '') return;
    AccessibilityInfo.announceForAccessibility(text);
  }, [strommar, text]);

  return (
    <View
      style={styles.svarsrad}
      accessible={!strommar}
      accessibilityElementsHidden={strommar}
      importantForAccessibility={strommar ? 'no-hide-descendants' : 'yes'}
    >
      <View style={styles.svarsrubrik}>
        <IkonRabbitAI
          storlek={24}
          farg={farg['text'] ?? '#000'}
          detalj={farg['greenIcon'] ?? '#1ED63C'}
          gnista={farg['greenIcon'] ?? '#1ED63C'}
        />
        <Text maxFontSizeMultiplier={1.8} style={[styles.svarstext, styles.fyll, { color: farg['text'] }]}>
          {text}
          {strommar ? (
            <Text style={[styles.markor, { color: farg['greenIcon'] }]}>{' ▌'}</Text>
          ) : null}
        </Text>
      </View>

      {stoppat ? (
        <Text maxFontSizeMultiplier={1.5} style={[TEXT['meta'], styles.underSvar, { color: farg['muted'] }]}>
          Stoppat.
        </Text>
      ) : null}

      {/* Källorna svaret slogs upp i. Ett tryck öppnar sidan. */}
      {!strommar && kallor !== undefined && kallor.length > 0 ? <Kallor kallor={kallor} /> : null}

      {/* Kopiera syns när svaret är klart och har text. */}
      {!strommar && text.trim() !== '' ? <Kopiera text={text} /> : null}

      {raknaPa !== undefined && onRaknaPa !== undefined ? (
        <Animated.View
          entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
          exiting={FadeOut.duration(REDUCERAD_MS)}
          style={styles.underSvar}
        >
          <RaknaPaDet onPress={onRaknaPa} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Källorna under svaret.
 *
 * En rad per sida: domänen i vikt, titeln under. Ett tryck öppnar sidan i
 * telefonens webbläsare med `Linking` — ingen ny inbyggd modul, och ingen
 * webbvy inuti appen. Adressen är redan kontrollerad i lib/chatt-karna.ts:
 * bara http och https kommer hit.
 */
function Kallor({ kallor }: { readonly kallor: readonly Kalla[] }): ReactNode {
  const { farg } = useTema();
  const haptik = useHaptik();
  /**
   * Tre källor syns, resten fälls ut (direktiv 24).
   *
   * Åtta rader under varje svar sköt bort svaret självt, särskilt vid stor
   * textstorlek. Tre räcker för att se var uppgiften kommer ifrån, och den
   * som vill granska fäller ut resten.
   */
  const [allaVisas, setAllaVisas] = useState(false);
  const SYNS = 3;
  const visade = allaVisas ? kallor : kallor.slice(0, SYNS);
  const kvar = kallor.length - visade.length;

  return (
    <View style={styles.kallor}>
      <Text
        maxFontSizeMultiplier={1.4}
        style={[styles.kallrubrik, { color: farg['muted'] }]}
      >
        {kallor.length === 1 ? 'KÄLLA' : 'KÄLLOR'}
      </Text>
      {visade.map((k) => (
        <Pressable
          key={k.adress}
          accessibilityRole="link"
          accessibilityLabel={`${k.titel}. ${k.doman}`}
          accessibilityHint="Öppnar sidan i webbläsaren."
          onPress={() => {
            haptik('latt');
            void Linking.openURL(k.adress).catch(() => undefined);
          }}
          style={({ pressed }) => [
            styles.kallrad,
            {
              backgroundColor: farg['card'],
              borderColor: farg['border'],
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
            style={[styles.kalldoman, { color: farg['greenText'] }]}
          >
            {k.doman}
          </Text>
          <Text
            numberOfLines={2}
            maxFontSizeMultiplier={1.4}
            style={[styles.kalltitel, { color: farg['text'] }]}
          >
            {k.titel}
          </Text>
        </Pressable>
      ))}

      {kvar > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Visa ${kvar} fler källor`}
          onPress={() => {
            haptik('latt');
            setAllaVisas(true);
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.visafler, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text
            maxFontSizeMultiplier={1.4}
            style={[styles.visaflertext, { color: farg['greenText'] }]}
          >
            {`Visa ${kvar} fler`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Kopiera-raden under svaret. Ikonen blir en bock i 1,2 s. */
function Kopiera({ text }: { readonly text: string }): ReactNode {
  const { farg } = useTema();
  const haptik = useHaptik();
  const [kopierat, setKopierat] = useState(false);

  useEffect(() => {
    if (!kopierat) return undefined;
    const t = setTimeout(() => setKopierat(false), 1200);
    return () => clearTimeout(t);
  }, [kopierat]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={kopierat ? 'Kopierat' : 'Kopiera svaret'}
      onPress={() => {
        void Clipboard.setStringAsync(text);
        haptik('bekraftelse');
        setKopierat(true);
        AccessibilityInfo.announceForAccessibility('Kopierat');
      }}
      // Raden ar 32 pt enligt KOMPONENTER.md. Traffytan ska vara 44, sa
      // hitSlop lagger pa 8 pt runt om (direktiv 23).
      hitSlop={8}
      style={({ pressed }) => [styles.kopiera, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        {kopierat ? (
          <Path
            d="m5 12.5 4.5 4.5L19 7"
            stroke={farg['greenText']}
            strokeWidth={2.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <Rect x={8.5} y={8.5} width={11} height={11} rx={2.5} stroke={farg['muted']} strokeWidth={1.9} />
            <Path
              d="M15.5 5.5h-9a2 2 0 0 0-2 2v9"
              stroke={farg['muted']}
              strokeWidth={1.9}
              strokeLinecap="round"
            />
          </>
        )}
      </Svg>
      <Text
        maxFontSizeMultiplier={1.4}
        style={[styles.kopieratext, { color: kopierat ? farg['greenText'] : farg['muted'] }]}
      >
        {kopierat ? 'Kopierat' : 'Kopiera'}
      </Text>
    </Pressable>
  );
}

/**
 * 21c-1: tre punkter som pulserar i följd, 900 ms per varv.
 *
 * Söker modellen på webben står det också vad den gör. En sökning tar
 * sekunder, inte tiondelar, och tystnad utan förklaring känns som ett fel.
 */
function Tanker({ soker = false }: { readonly soker?: boolean }): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={soker ? 'Rabbit AI söker på webben' : 'Rabbit AI tänker'}
      style={styles.tanker}
    >
      <IkonRabbitAI
        storlek={24}
        farg={farg['text'] ?? '#000'}
        detalj={farg['greenIcon'] ?? '#1ED63C'}
        gnista={farg['greenIcon'] ?? '#1ED63C'}
      />
      <View style={styles.punkter}>
        {[0, 1, 2].map((i) => (
          <Punkt key={i} ordning={i} reducerad={rorelse.reducerad} farg={farg['greenIcon'] ?? '#1ED63C'} />
        ))}
      </View>
      {soker ? (
        <Text maxFontSizeMultiplier={1.5} style={[TEXT['secondary'], { color: farg['muted'] }]}>
          Söker på webben …
        </Text>
      ) : null}
    </View>
  );
}

function Punkt({
  ordning,
  reducerad,
  farg,
}: {
  readonly ordning: number;
  readonly reducerad: boolean;
  readonly farg: string;
}): ReactNode {
  // Med reducerad rörelse står punkterna still i 0,6 (RORELSE-HAPTIK.md v4).
  const v = useSharedValue(reducerad ? 0.6 : 0.25);

  useEffect(() => {
    if (reducerad) {
      v.value = 0.6;
      return;
    }
    v.value = withDelay(
      ordning * 300,
      withRepeat(
        withSequence(withTiming(1, { duration: 450 }), withTiming(0.25, { duration: 450 })),
        -1,
        false,
      ),
    );
  }, [ordning, reducerad, v]);

  const stil = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[styles.punkt, { backgroundColor: farg }, stil]} />;
}

/** 21d: kortet som flyttar frågan till Räkna och räknar den. */
function RaknaPaDet({ onPress }: { readonly onPress: () => void }): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const haptik = useHaptik();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Räkna på det, flyttar frågan till Räkna"
      onPress={() => {
        haptik('latt');
        onPress();
      }}
      style={({ pressed }) => [
        styles.raknakort,
        {
          backgroundColor: farg['card'],
          borderColor: farg['greenIcon'],
          transform: [{ scale: pressed ? rorelse.tryckskala : 1 }],
        },
      ]}
    >
      <View style={[styles.raknaikon, { backgroundColor: farg['greenSoft'] }]}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Rect x={5} y={3} width={14} height={18} rx={2.5} stroke={farg['greenText']} strokeWidth={2} />
          <Path
            d="M8.5 7.5h7M8.5 12h2m3.5 0h2M8.5 16.5h2m3.5 0h2"
            stroke={farg['greenText']}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      </View>
      <View style={styles.fyll}>
        <Text maxFontSizeMultiplier={1.5} style={[styles.raknatitel, { color: farg['text'] }]}>
          Räkna på det
        </Text>
        <Text maxFontSizeMultiplier={1.5} style={[TEXT['secondary'], { color: farg['muted'] }]}>
          Frågan fylls i Räkna, steg för steg
        </Text>
      </View>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 12h13m-5.5-5.5L18 12l-5.5 5.5"
          stroke={farg['greenText']}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

/** 21e: dagens frågor är slut. Räkna fungerar som vanligt. */
function Gransbesked({
  sekunder,
  onBytTillRakna,
}: {
  readonly sekunder: number;
  readonly onBytTillRakna: () => void;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const nar =
    sekunder > 0
      ? `Rabbit AI är tillbaka vid midnatt, om ${tidKvar(sekunder)}.`
      : 'Rabbit AI är tillbaka vid midnatt.';
  return (
    <Animated.View
      entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
      accessible
      accessibilityLabel={`Dagens frågor är slut. ${nar} Räkna fungerar som vanligt.`}
      style={[styles.granskort, { backgroundColor: farg['card'] }]}
    >
      <View style={[styles.gransikon, { backgroundColor: farg['inset'] }]}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.2V12l3.2 2"
            stroke={farg['muted']}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.5}
        style={[TEXT['sheetTitle'], { color: farg['text'] }]}
      >
        Dagens frågor är slut
      </Text>
      <Text maxFontSizeMultiplier={1.7} style={[TEXT['secondary'], { color: farg['muted'] }]}>
        {nar} Räkna fungerar som vanligt.
      </Text>
      <SekundarKnapp titel="Byt till Räkna" onPress={onBytTillRakna} />
    </Animated.View>
  );
}

/**
 * 21f: panelen med tidigare samtal.
 *
 * Glider in från vänster på 280 ms, dimmern tonas in på 200 ms. Stängs genom
 * tryck på dimmern, krysset eller tillbaka-gesten.
 */
function Samtalspanel({
  oppen,
  samtal,
  aktivt,
  overkant,
  underkant,
  onStang,
  onOppna,
  onRensa,
  onTaBort,
}: {
  readonly oppen: boolean;
  readonly samtal: readonly Samtal[];
  readonly aktivt: string;
  readonly overkant: number;
  readonly underkant: number;
  readonly onStang: () => void;
  readonly onOppna: (s: Samtal) => void;
  readonly onRensa: () => void;
  readonly onTaBort: (id: string) => void;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const [sok, setSok] = useState('');
  const [rensafraga, setRensafraga] = useState(false);

  const traff = samtal.filter((s) =>
    sok.trim() === ''
      ? true
      : s.meddelanden.some((m) => m.text.toLowerCase().includes(sok.trim().toLowerCase())),
  );

  return (
    <Modal visible={oppen} transparent animationType="none" onRequestClose={onStang}>
      <Animated.View
        entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
        style={styles.dimmer}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stäng tidigare samtal"
          onPress={onStang}
          style={styles.fyll}
        />
      </Animated.View>

      <Animated.View
        entering={
          rorelse.reducerad
            ? FadeIn.duration(REDUCERAD_MS)
            : SlideInLeft.duration(SKARM_MS)
        }
        style={[
          styles.panel,
          {
            backgroundColor: farg['bg'],
            paddingTop: overkant + 10,
            paddingBottom: underkant + 10,
          },
        ]}
      >
        <View style={styles.panelhuvud}>
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={1.4}
            style={[styles.paneltitel, styles.fyll, { color: farg['text'] }]}
          >
            Tidigare samtal
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stäng"
            onPress={onStang}
            style={({ pressed }) => [styles.huvudknapp, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 6l12 12M18 6 6 18"
                stroke={farg['text']}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

        <View style={[styles.sok, { backgroundColor: farg['track'] }]}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm5.2.2L21 21"
              stroke={farg['muted']}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
          <TextInput
            value={sok}
            onChangeText={setSok}
            placeholder="Sök i samtal"
            inputAccessoryViewID={KLAR_ID_PANEL}
            placeholderTextColor={farg['faint']}
            accessibilityLabel="Sök i samtal"
            maxFontSizeMultiplier={1.5}
            style={[styles.soktext, { color: farg['text'] }]}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.panellista}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {traff.length === 0 ? (
            <Text maxFontSizeMultiplier={1.6} style={[TEXT['body'], { color: farg['muted'] }]}>
              {samtal.length === 0 ? 'Inga samtal än.' : 'Inget samtal matchar sökningen.'}
            </Text>
          ) : (
            traff.map((s) => (
              // Svep åt vänster tar bort just det samtalet, som i Historik.
              <Svepbar key={s.id} etikett={samtalsrubrik(s)} onTaBort={() => onTaBort(s.id)}>
                {(stangOmOppen) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: s.id === aktivt }}
                    accessibilityLabel={`${samtalsrubrik(s)}. ${s.meddelanden.length} meddelanden, ${visaDatum(s.datum)}`}
                    accessibilityHint="Svep åt vänster för att ta bort."
                    onPress={() => {
                      if (!stangOmOppen()) onOppna(s);
                    }}
                    style={({ pressed }) => [
                      styles.panelrad,
                      { backgroundColor: s.id === aktivt ? farg['card'] : farg['bg'] },
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.4}
                      style={[styles.panelfraga, { color: farg['text'] }]}
                    >
                      {samtalsrubrik(s)}
                    </Text>
                    <Text maxFontSizeMultiplier={1.4} style={[TEXT['meta'], { color: farg['muted'] }]}>
                      {`${s.meddelanden.length} meddelanden · ${visaDatum(s.datum)}`}
                    </Text>
                  </Pressable>
                )}
              </Svepbar>
            ))
          )}
        </ScrollView>
        {/* Panelens egen Klar-rad: sokfaltet ligger i ett eget trad. */}
        <Klarrad id={KLAR_ID_PANEL} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rensa alla samtal"
          disabled={samtal.length === 0}
          onPress={() => setRensafraga(true)}
          style={({ pressed }) => [
            styles.rensa,
            { opacity: samtal.length === 0 ? 0.4 : pressed ? 0.6 : 1 },
          ]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 13h9l1-13"
              stroke={farg['burn']}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text maxFontSizeMultiplier={1.4} style={[styles.rensatext, { color: farg['burn'] }]}>
            Rensa alla samtal
          </Text>
        </Pressable>
      </Animated.View>

      <Bekraftelsedialog
        oppen={rensafraga}
        titel="Rensa alla samtal?"
        text="Alla sparade samtal tas bort från telefonen. Det går inte att ångra."
        bekraftaTitel="Rensa alla"
        onBekrafta={() => {
          setRensafraga(false);
          onRensa();
        }}
        onAvbryt={() => setRensafraga(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  fyll: { flex: 1 },

  huvud: { height: 52, flexDirection: 'row', alignItems: 'center' },
  huvudknapp: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  huvudmitt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  huvudnamn: { fontSize: 18, fontFamily: 'Archivo_900Black', includeFontPadding: false },
  marke: { height: 20, borderRadius: 10, paddingHorizontal: 8, justifyContent: 'center' },
  marketext: { fontSize: 11, fontFamily: 'Archivo_800ExtraBold', includeFontPadding: false },

  valkomst: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
  valkomstspalt: { gap: 10 },
  underrad: { fontSize: 15, lineHeight: 21, fontFamily: 'Archivo_500Medium' },
  forslagspalt: { gap: 10, marginTop: 14 },
  forslagkort: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 62,
  },
  kategori: {
    fontSize: 11,
    fontFamily: 'Archivo_800ExtraBold',
    letterSpacing: 0.8,
    includeFontPadding: false,
    marginBottom: 3,
  },
  forslagfraga: { fontSize: 15, lineHeight: 20, fontFamily: 'Archivo_600SemiBold' },

  trad: { paddingBottom: 16, paddingTop: 6 },
  bubbelrad: { alignItems: 'flex-end', marginTop: 14 },
  bubbla: {
    maxWidth: '78%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bubbeltext: { fontSize: 16, lineHeight: 22, fontFamily: 'Archivo_600SemiBold' },

  svarsrad: { marginTop: 16 },
  svarsrubrik: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  svarstext: { fontSize: 16, lineHeight: 24, fontFamily: 'Archivo_500Medium' },
  markor: { fontSize: 16 },
  underSvar: { marginTop: 10, marginLeft: 34 },
  kopiera: {
    marginTop: 10,
    marginLeft: 34,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    paddingRight: 8,
  },
  kopieratext: { fontSize: 13, fontFamily: 'Archivo_600SemiBold', includeFontPadding: false },

  tanker: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  kallor: { marginTop: 12, marginLeft: 34, gap: 6 },
  kallrubrik: { fontSize: 11, fontFamily: 'Archivo_800ExtraBold', letterSpacing: 0.7 },
  kallrad: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 1,
    justifyContent: 'center',
  },
  kalldoman: { fontSize: 12, fontFamily: 'Archivo_700Bold' },
  visafler: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 },
  visaflertext: { fontSize: 13, fontFamily: 'Archivo_700Bold' },
  kalltitel: { fontSize: 13, lineHeight: 17, fontFamily: 'Archivo_500Medium' },
  punkter: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 24 },
  punkt: { width: 8, height: 8, borderRadius: 4 },

  raknakort: {
    borderRadius: 18,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  raknaikon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  raknatitel: { fontSize: 16, fontFamily: 'Archivo_800ExtraBold', includeFontPadding: false },

  granskort: { borderRadius: 20, padding: 18, gap: 10, marginTop: 16 },
  gransikon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  kompositor: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },
  falt: {
    flex: 1,
    minHeight: 48,
    maxHeight: 128,
    borderRadius: 24,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 18,
    paddingRight: 5,
  },
  falttext: { fontSize: 16, paddingVertical: 13 },
  rund: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },

  dimmer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 318,
    paddingHorizontal: 16,
  },
  panelhuvud: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  paneltitel: { fontSize: 24, fontFamily: 'Archivo_900Black', includeFontPadding: false },
  sok: {
    height: 40,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  soktext: { flex: 1, fontSize: 15, padding: 0 },
  panellista: { paddingVertical: 12, gap: 4 },
  panelrad: { minHeight: 62, borderRadius: 14, justifyContent: 'center', paddingHorizontal: 12, gap: 3 },
  panelfraga: { fontSize: 16, fontFamily: 'Archivo_700Bold', includeFontPadding: false },
  rensa: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rensatext: { fontSize: 15, fontFamily: 'Archivo_800ExtraBold', includeFontPadding: false },
});
