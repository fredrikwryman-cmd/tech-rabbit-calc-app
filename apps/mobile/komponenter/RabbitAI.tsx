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

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  FlatList,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  SlideInLeft,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { KeyboardAvoidingView, KeyboardGestureArea } from 'react-native-keyboard-controller';
import Svg, { Path, Rect } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '../design/tema';
import { KLAR_ID_CHAT, KLAR_ID_PANEL, Klarrad, TANGENTBORDSBETEENDE } from './Tangentbord';
import { TEXT } from '../design/tokens';
import { samtalsrubrik, tidKvar, type Kalla, type Meddelande, type Samtal } from '../lib/chatt';
import {
  byggTrad,
  inverterat,
  tidIBubbla,
  type Gruppflaggor,
  type Tradpost,
} from '../lib/chatt-trad';
import { visaDatum, type Historikpost } from '../lib/lagring';
import { REDUCERAD_MS, rm, SKARM_MS, useHaptik, useRorelse, YTA_MS } from '../lib/rorelse';
import { useRost } from '../lib/rost';

import { Bekraftelsedialog } from './Dialog';
import { AiKaninLiten, AiKaninStor, kaninLitenBredd } from './Bilder';
import { LevandeTal } from './LevandeTal';
import { LitenKnapp, SekundarKnapp } from './Knapp';
import { Lyssnarrad, Mikrofonknapp, Rostbesked } from './Rost';
import { Svepbar } from './Svepbar';

/**
 * Den lilla AI-kaninens höjd i chatten (direktiv 37). Den ersätter den
 * ritade kaninikonen i rubriken, vid varje svar och medan modellen tänker.
 */
const KANIN_LITEN_PT = 40;

/** Indraget under ett svar: kaninens bredd plus mellanrummet i svarsraden. */
const SVARSINDRAG = kaninLitenBredd(KANIN_LITEN_PT) + 10;

/**
 * Skrivindikatorns förskjutning mellan punkterna, rev-ux 5.7.
 *
 * 150 ms mellan punkterna i ett varv på 900 ms: vågen går igenom raden i
 * stället för att punkterna blinkar var för sig.
 */
const PUNKTFORSKJUTNING_MS = 150;

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
  /**
   * Direktiv 36: id:t följer med frågan, när servern lämnade ett. Räkna
   * skickar det vidare och slipper tolka om samma mening.
   */
  readonly onRaknaPa: (fraga: string, tolkningsId?: string) => void;
  readonly onBytTillRakna: () => void;
  /** 21f: de sparade samtalen, nyast först. */
  readonly samtal: readonly Samtal[];
  readonly onOppnaSamtal: (s: Samtal) => void;
  readonly onRensaSamtal: () => void;
  /** Svep åt vänster på en rad i 21f tar bort just det samtalet. */
  readonly onTaBortSamtal: (id: string) => void;
  /** Id:t på samtalet som visas, så att raden kan märkas som vald. */
  readonly aktivtSamtal: string;
  /**
   * Direktiv 40, rev-ux 5.6: uträkningarna, för innehållskorten i tråden.
   *
   * Ett meddelande med `raknatId` är kortet för en uträkning Räkna gjorde.
   * Kortet läser posten härifrån i stället för att bära en kopia av svaret:
   * ett svar som ändras i historiken ska inte stå kvar gammalt i chatten.
   */
  readonly raknade: readonly Historikpost[];
  /** Ett tryck på innehållskortet öppnar resultatarket. */
  readonly onOppnaRaknat: (post: Historikpost) => void;
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
    raknade,
    onOppnaRaknat,
  } = props;
  const { farg } = useTema();
  const rorelse = useRorelse();
  const haptik = useHaptik();
  const insets = useSafeAreaInsets();
  const traden = useRef<FlatList<Tradpost<Meddelande & Gruppflaggor>>>(null);
  const [langstNed, setLangstNed] = useState(true);
  const [panelen, setPanelen] = useState(false);
  /** Bubblan som långtrycks (rev-ux 5.7). Null = ingen meny. */
  const [menyn, setMenyn] = useState<Bubbelmenyn | null>(null);
  /** Rösten (vy 40b och 41). Texten landar i kompositören, inget skickas. */
  const rost = useRost({ onText: onUtkast });

  const aktivt = strommar !== null;
  const avstangt = slutOm !== null;
  const kanSkicka = utkast.trim() !== '' && !aktivt && !avstangt;
  const tomt = meddelanden.length === 0 && !aktivt && !avstangt;

  /**
   * Tråden, äldst först, med grupper, svansar, datumrubriker och luckor, och
   * sedan vänd en gång för den inverterade listan (rev-ux 5.2 och 8.6).
   *
   * Den inverterade listan är hela svaret på "öppna längst ned utan synlig
   * scroll" (5.7): listan STÅR längst ned, den scrollas inte dit.
   */
  const poster = useMemo(
    () => inverterat(byggTrad(meddelanden)),
    [meddelanden],
  );

  /**
   * De senaste bubblornas entré när tråden öppnas (5.7).
   *
   * Bara de fyra nedersta tonar in med stagger. Räknas en gång per tråd:
   * ett nytt meddelande ska inte få hela tråden att tona om.
   */
  const [vidOppning] = useState(() => meddelanden.length);

  /**
   * Vad som ska hända med rad nr `nr` när den ritas.
   *
   * `fodd`: kom efter att tråden öppnades — föds vid skrivfältet (5.5).
   * `entre`: en av de fyra nedersta vid öppning — tonar in med stagger (5.7).
   * `still`: allt äldre. Den inverterade listan monterar om rader när man
   * scrollar, och en gammal bubbla som flyger in vore ett fel, inte en
   * animation.
   */
  const radlage = useCallback(
    (nr: number): Radlage =>
      nr >= vidOppning ? 'fodd' : nr >= vidOppning - 4 ? 'entre' : 'still',
    [vidOppning],
  );

  /**
   * Nytt svar medan man läser längre upp (5.7).
   *
   * Tråden står still — den inverterade listan håller sitt läge av sig
   * själv — och pillen säger att det kommit något.
   */
  const [nyttLangreNed, setNyttLangreNed] = useState(false);
  const senasteAntal = useRef(meddelanden.length);
  useEffect(() => {
    const vaxte = meddelanden.length > senasteAntal.current;
    senasteAntal.current = meddelanden.length;
    if (vaxte && !langstNed) setNyttLangreNed(true);
    if (langstNed) setNyttLangreNed(false);
  }, [meddelanden.length, langstNed]);

  const tillNed = useCallback(() => {
    setNyttLangreNed(false);
    // Index 0 ligger längst ned i en inverterad lista.
    traden.current?.scrollToOffset({ offset: 0, animated: !rorelse.reducerad });
  }, [rorelse.reducerad]);

  return (
    <KeyboardAvoidingView
      behavior={TANGENTBORDSBETEENDE}
      /* Vyn mäter sitt eget läge: tabbaren räknas in (direktiv 41). */
      automaticOffset
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
          <AiKaninLiten hojd={KANIN_LITEN_PT} />
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

        {/*
          Direktiv 40 steg 5: "Nytt samtal" flyttade till handlingsraden
          mellan tråden och fältet, dit rev-ux 5.1 lägger samtalets
          handlingar. Platsen står kvar tom och lika bred, så att namnet i
          mitten ligger kvar exakt där det låg.
        */}
        <View style={styles.huvudknapp} />
      </View>

      {/*
        Ett tryck i traden stanger tangentbordet (direktiv 32 och 33).
        Skarm.tsx gor det pa de andra flikarna, men chatten ritar sin egen
        ram och maste gora det sjalv. Bubblorna tar sina egna tryck.
      */}
      {tomt ? (
        <Pressable accessible={false} onPress={() => Keyboard.dismiss()} style={styles.fyll}>
          <Valkomst onForslag={(f) => onSkicka(f)} />
        </Pressable>
      ) : (
        /*
          Direktiv 41: KeyboardGestureArea ger ANDROID ett tangentbord som
          följer fingret — det som keyboardDismissMode="interactive" gör av
          sig själv på iOS. Vyn väljer själv: native på iOS och Android 11+,
          en vanlig View på äldre Android. Därför står ingen
          plattformskontroll här, och gesten är densamma på båda.
        */
        <KeyboardGestureArea interpolator="ios" style={styles.fyll}>
          <FlatList
            ref={traden}
            /*
              Inverterad lista (direktiv 40 steg 1): index 0 ligger längst NED.
              Tråden står alltså längst ned från början, utan en scroll som
              syns, och ett nytt meddelande skjuter in underifrån medan läget
              längre upp står still av sig själv.

              Cellerna är vända (scaleY -1) och vänds tillbaka av listan. Det
              betyder att en förflyttning i y syns MOTVÄNT i en cell — därför
              räknar bubblornas entré med tecknet själv, i stället för att lita
              på FadeInDown/FadeInUp.
            */
            inverted
            data={poster}
            keyExtractor={(p) => p.nyckel}
            onStartShouldSetResponderCapture={() => {
              // Ett tryck i tråden stänger tangentbordet (direktiv 32 och 33).
              // Returnerar false: trycket går vidare till bubblan under.
              Keyboard.dismiss();
              return false;
            }}
            keyboardShouldPersistTaps="handled"
            /*
              Drag i tråden drar NED tangentbordet, och det följer fingret
              (rev-ux 5.7 och 8.6).

              Direktiv 33 fick nöja sig med "on-drag": "interactive" finns bara
              i React Natives iOS-del, och vägen ut ur tangentbordet får aldrig
              bero på plattform. Nu ligger tråden i en KeyboardGestureArea, som
              ger Android samma gest — så "interactive" betyder samma sak på
              båda, och släpper man mitt i gesten kommer tangentbordet tillbaka.
            */
            keyboardDismissMode="interactive"
            contentContainerStyle={styles.trad}
            /* Gummiband i trådens båda ändar (rev-ux 4.3). */
            alwaysBounceVertical
            onScroll={(e) => {
              // Inverterad lista: offset 0 ÄR längst ned.
              setLangstNed(e.nativeEvent.contentOffset.y <= 40);
            }}
            scrollEventThrottle={64}
            /*
              Det levande: tänker-punkterna, svaret som strömmar och beskedet om
              dagens gräns. I en inverterad lista ritas huvudet längst ned, så
              det hamnar precis där det hör hemma — närmast fältet.
            */
            ListHeaderComponent={
              !aktivt && !avstangt ? undefined : (
                <View style={styles.levande}>
                  {strommar === '' ? <Tanker soker={soker} /> : null}
                  {strommar !== null && strommar !== '' ? (
                    <Svar text={strommar} stoppat={false} strommar sist />
                  ) : null}
                  {avstangt ? (
                    <Gransbesked sekunder={slutOm} onBytTillRakna={onBytTillRakna} />
                  ) : null}
                </View>
              )
            }
            renderItem={({ item }) => {
              if (item.sort === 'datum') return <Datumrubrik text={item.text} />;
              const m = item.m;
              const raknat =
                m.raknatId === undefined
                  ? undefined
                  : raknade.find((p) => p.id === m.raknatId);
              return (
                <Tradrad
                  lucka={item.lucka}
                  lage={radlage(item.nr)}
                  ordning={Math.max(0, item.nr - (vidOppning - 4))}
                >
                  {raknat !== undefined ? (
                    <Raknatkort post={raknat} onPress={() => onOppnaRaknat(raknat)} />
                  ) : m.roll === 'jag' ? (
                    <Bubbla
                      text={m.text}
                      tid={tidIBubbla(m.at)}
                      sist={item.sist}
                      onLangtryck={(bubblan) => setMenyn(bubblan)}
                    />
                  ) : (
                    <Svar
                      text={m.text}
                      stoppat={m.stoppat === true}
                      strommar={false}
                      sist={item.sist}
                      tid={tidIBubbla(m.at)}
                      onLangtryck={(bubblan) => setMenyn(bubblan)}
                      {...(m.raknaPa !== undefined
                        ? {
                            raknaPa: m.raknaPa,
                            onRaknaPa: () => onRaknaPa(m.raknaPa as string, m.tolkningsId),
                          }
                        : {})}
                      {...(m.kallor !== undefined && m.kallor.length > 0
                        ? { kallor: m.kallor }
                        : {})}
                    />
                  )}
                </Tradrad>
              );
            }}
          />
        </KeyboardGestureArea>
      )}

      {/* 5.7: pillen när något kommit medan man läser längre upp. */}
      {nyttLangreNed ? <Nyttpill onPress={tillNed} /> : null}

      {/* 5.1: handlingsraden mellan tråden och fältet, alltid synlig. */}
      <Handlingsrad
        onNyttSamtal={() => {
          haptik('latt');
          onNyttSamtal();
        }}
        onBytTillRakna={onBytTillRakna}
      />

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
        <Animated.View
          /* Fältet växer till fem rader med layout-animation (rev-ux 5.4). */
          layout={
            rorelse.reducerad
              ? undefined
              : LinearTransition.springify().damping(rm.smooth.damping).stiffness(rm.smooth.stiffness)
          }
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
        </Animated.View>

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
          /*
            rev-ux 5.4: EN plats, två handlingar. Tom ruta visar mikrofonen,
            skriven text visar skicka-pilen, och de byter av varandra med
            crossfade och skala 0.6 → 1 på 160 ms.
          */
          <Faltknapp
            visaSkicka={avstangt || utkast.trim() !== ''}
            kanSkicka={kanSkicka}
            rostlage={rost.lage}
            onStartaRost={rost.starta}
            onStoppaRost={rost.stoppa}
            onSkicka={() => {
              haptik('latt');
              // Tangentbordet ligger kvar efter skick (rev-ux 5.4). Fältet
              // töms av skärmen, så nästa fråga går att skriva direkt.
              onSkicka();
            }}
          />
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
        /*
          Direktiv 41: varningen ligger numera på knappen som öppnar frågan,
          inne i panelen, som i Historik. Här är bara själva rensningen.
        */
        onRensa={onRensaSamtal}
        onTaBort={onTaBortSamtal}
      />
      {/* 5.7: menyn som växer ur bubblan vid långtryck. */}
      <Bubbelmeny menyn={menyn} onStang={() => setMenyn(null)} />

      {/* Chattens Klar-rad: stanger tangentbordet utan att skicka. */}
      <Klarrad id={KLAR_ID_CHAT} />
    </KeyboardAvoidingView>
  );
}

// ------------------------------------------------------------ trådens rader

/**
 * Vad som händer med en rad när den ritas.
 *
 * Se `radlage` i RabbitAI: `fodd` kom efter att tråden öppnades, `entre` är
 * en av de fyra nedersta vid öppning, `still` är allt äldre.
 */
export type Radlage = 'fodd' | 'entre' | 'still';

/**
 * Hur långt under sin plats en ny bubbla föds, i punkter (rev-ux 5.5).
 *
 * Positivt tal = nedåt, som vanligt. Cellerna i en inverterad lista vänds
 * TVÅ gånger (en gång av listan, en gång av cellen), så allt inne i en cell
 * ligger och rör sig precis som i en vanlig lista. Det är bara listans
 * contentContainer som är vänd en gång — därför, och bara därför, är
 * `trad`-stilens över- och underkant bytta.
 */
const FODELSE_PT = 12;

/**
 * En rad i tråden: luckan ovanför och entrén.
 *
 * Entrén ligger på en delad värde i stället för på `entering`, så att
 * tecknet på förflyttningen och fjädern står skrivna här i stället för att
 * gömmas i ett färdigt namn.
 */
function Tradrad({
  lucka,
  lage,
  ordning,
  children,
}: {
  readonly lucka: number;
  readonly lage: Radlage;
  readonly ordning: number;
  readonly children: ReactNode;
}): ReactNode {
  const rorelse = useRorelse();
  const liv = useSharedValue(lage === 'still' ? 1 : 0);
  /** Bara en nyfödd bubbla flyttar sig. Entrén och reducerad rörelse tonar. */
  const flyttar = lage === 'fodd' && !rorelse.reducerad;

  useEffect(() => {
    if (lage === 'still') {
      liv.value = 1;
      return;
    }
    if (rorelse.reducerad) {
      liv.value = withTiming(1, { duration: REDUCERAD_MS });
      return;
    }
    if (lage === 'fodd') {
      liv.value = withSpring(1, rm.bubble);
      return;
    }
    liv.value = withDelay(ordning * rm.stagger, withTiming(1, { duration: YTA_MS }));
  }, [lage, ordning, rorelse.reducerad, liv]);

  const stil = useAnimatedStyle(() => ({
    // Fjädern studsar lätt förbi 1; opaciteten får inte följa med.
    opacity: Math.min(1, liv.value),
    transform: flyttar
      ? [
          { translateY: FODELSE_PT * (1 - liv.value) },
          { scale: 0.96 + 0.04 * liv.value },
        ]
      : [],
  }));

  return (
    <Animated.View
      layout={
        rorelse.reducerad
          ? undefined
          : LinearTransition.springify()
              .damping(rm.smooth.damping)
              .stiffness(rm.smooth.stiffness)
      }
      style={[{ marginTop: lucka }, stil]}
    >
      {children}
    </Animated.View>
  );
}

/** Datumrubriken över dagens första grupp: centrerad och dämpad (5.2). */
function Datumrubrik({ text }: { readonly text: string }): ReactNode {
  const { farg } = useTema();
  return (
    <View style={styles.datumrad}>
      <Text maxFontSizeMultiplier={1.4} style={[styles.datumtext, { color: farg['muted'] }]}>
        {text}
      </Text>
    </View>
  );
}

/** Bubblan som långtrycks, med sitt läge på skärmen (5.7). */
interface Bubbelmenyn {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly bredd: number;
  readonly hojd: number;
  /** Egen bubbla (höger) eller ett svar (vänster). */
  readonly egen: boolean;
}

/** 5.7: pillen som säger att något kommit medan man läser längre upp. */
function Nyttpill({ onPress }: { readonly onPress: () => void }): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  return (
    <Animated.View
      entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
      exiting={FadeOut.duration(REDUCERAD_MS)}
      style={styles.pillrad}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nytt svar, gå till slutet av samtalet"
        onPress={onPress}
        hitSlop={8}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: farg['card'],
            borderColor: farg['controlBorder'],
            transform: [{ scale: pressed ? rorelse.tryckskala : 1 }],
          },
        ]}
      >
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 5v13m-6.5-6.5L12 18l6.5-6.5"
            stroke={farg['greenText']}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <Text maxFontSizeMultiplier={1.4} style={[styles.pilltext, { color: farg['text'] }]}>
          Nytt svar
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * 5.1: handlingsraden mellan tråden och fältet.
 *
 * Alltid synlig, och den bär de handlingar chatten redan hade: nytt samtal
 * (som låg i huvudet) och Räkna-läget (som bara syntes i beskedet om dagens
 * gräns). Inget nytt är uppfunnet här.
 */
function Handlingsrad({
  onNyttSamtal,
  onBytTillRakna,
}: {
  readonly onNyttSamtal: () => void;
  readonly onBytTillRakna: () => void;
}): ReactNode {
  const { farg } = useTema();
  return (
    <View style={styles.handlingsrad}>
      <LitenKnapp
        titel="Ny chatt"
        onPress={onNyttSamtal}
        ikon={
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M16.5 3.8 20.2 7.5 8.8 18.9 4.3 19.7 5.1 15.2z"
              stroke={farg['text']}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </Svg>
        }
      />
      <LitenKnapp
        titel="Räkna"
        onPress={onBytTillRakna}
        ikon={
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Rect x={5} y={3} width={14} height={18} rx={2.5} stroke={farg['text']} strokeWidth={1.9} />
            <Path
              d="M8.5 7.5h7M8.5 12h2m3.5 0h2M8.5 16.5h2m3.5 0h2"
              stroke={farg['text']}
              strokeWidth={1.9}
              strokeLinecap="round"
            />
          </Svg>
        }
      />
    </View>
  );
}

/**
 * En plats, två handlingar (rev-ux 5.4).
 *
 * Tomt fält visar mikrofonen, skriven text visar skicka-pilen. De ligger på
 * samma 48 pt och byter av varandra med crossfade och skala 0.6 → 1 på
 * `rm.swap`. Båda ligger kvar i trädet: en knapp som tas ur trädet kan inte
 * tona ut, och då blev bytet ett hopp.
 */
function Faltknapp({
  visaSkicka,
  kanSkicka,
  rostlage,
  onStartaRost,
  onStoppaRost,
  onSkicka,
}: {
  readonly visaSkicka: boolean;
  readonly kanSkicka: boolean;
  readonly rostlage: ReturnType<typeof useRost>['lage'];
  readonly onStartaRost: () => void;
  readonly onStoppaRost: () => void;
  readonly onSkicka: () => void;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const till = visaSkicka ? 1 : 0;
  const v = useSharedValue(till);

  useEffect(() => {
    v.value = rorelse.reducerad
      ? withTiming(till, { duration: REDUCERAD_MS })
      : withSpring(till, rm.snappy);
  }, [till, rorelse.reducerad, v]);

  const skickastil = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, v.value)),
    transform: [{ scale: 0.6 + 0.4 * Math.min(1, Math.max(0, v.value)) }],
  }));
  const mikstil = useAnimatedStyle(() => {
    const kvar = Math.min(1, Math.max(0, 1 - v.value));
    return { opacity: kvar, transform: [{ scale: 0.6 + 0.4 * kvar }] };
  });

  return (
    <View style={styles.rund}>
      {/* Mikrofonen: den som inte är framme tar inga tryck. */}
      <Animated.View
        pointerEvents={visaSkicka ? 'none' : 'auto'}
        style={[styles.platsut, mikstil]}
      >
        <Mikrofonknapp
          lage={rostlage}
          storlek={48}
          onStarta={onStartaRost}
          onStoppa={onStoppaRost}
        />
      </Animated.View>

      <Animated.View
        pointerEvents={visaSkicka ? 'auto' : 'none'}
        style={[styles.platsut, skickastil]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skicka frågan"
          accessibilityState={{ disabled: !kanSkicka }}
          disabled={!kanSkicka}
          onPress={onSkicka}
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
      </Animated.View>
    </View>
  );
}

/**
 * Innehållskortet: uträkningen som kom hem från Räkna (rev-ux 5.3 och 5.6).
 *
 * Märke, det stora talet med etikett och enhet, och tiden. Kortet flyger in
 * i tråden med `send`-tiden och `hero`-fjädern — det är den enda rörelsen i
 * appen som får studsa mer än en bubbla, för det är en stor handling som
 * landar. Ett tryck öppnar resultatarket.
 */
function Raknatkort({
  post,
  onPress,
}: {
  readonly post: Historikpost;
  readonly onPress: () => void;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const haptik = useHaptik();
  const liv = useSharedValue(0);

  useEffect(() => {
    if (rorelse.reducerad) {
      liv.value = withTiming(1, { duration: REDUCERAD_MS });
      return;
    }
    liv.value = withSpring(1, rm.hero);
  }, [rorelse.reducerad, liv]);

  // Kortet krymper till sin plats: det börjar större och landar på 1.
  const stil = useAnimatedStyle(() => ({
    opacity: Math.min(1, liv.value),
    transform: rorelse.reducerad ? [] : [{ scale: 1.06 - 0.06 * liv.value }],
  }));

  /** Talet och enheten står i ett fält: "17,14 kr/kg". */
  const delar = post.resultat.trim().split(' ');
  const talet = delar[0] ?? post.resultat;
  const enheten = delar.slice(1).join(' ');

  return (
    <Animated.View style={stil}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Du räknade. ${post.resultat}. ${post.etikett}.`}
        accessibilityHint="Öppnar uträkningen."
        onPress={() => {
          haptik('latt');
          onPress();
        }}
        style={({ pressed }) => [
          styles.raknatkort,
          {
            backgroundColor: farg['card'],
            borderColor: farg['greenIcon'],
            transform: [{ scale: pressed ? rorelse.tryckskala : 1 }],
          },
        ]}
      >
        <Text maxFontSizeMultiplier={1.3} style={[styles.raknatmarke, { color: farg['greenText'] }]}>
          DU RÄKNADE
        </Text>
        <LevandeTal
          varde={talet}
          stil={{ ...styles.raknattal, color: farg['text'] ?? '#000' }}
          {...(enheten === ''
            ? {}
            : {
                enhet: enheten,
                enhetsstil: { ...styles.raknatenhet, color: farg['muted'] ?? '#666' },
              })}
        />
        <View style={styles.raknatfot}>
          <Text
            numberOfLines={2}
            maxFontSizeMultiplier={1.5}
            style={[styles.raknatetikett, styles.fyll, { color: farg['muted'] }]}
          >
            {post.etikett}
          </Text>
          <Text maxFontSizeMultiplier={1.3} style={[styles.bubbeltid, { color: farg['faint'] }]}>
            {tidIBubbla(Date.parse(post.datum))}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * 5.7: långtryck på en bubbla.
 *
 * Bubblan lyfts 1.03 och resten mörknar. Menyn växer ur bubblan — den har
 * sitt ursprung i bubblans kant, inte i skärmens mitt. Kopiera är den
 * handling chatten redan har.
 *
 * Kopian ritas i modalen på bubblans uppmätta plats. Originalet ligger kvar
 * under mörkläggningen: en bubbla kan inte både ligga i tråden och ovanpå
 * dimmern, och att mäta och rita en kopia är den enda vägen som inte flyttar
 * innehåll i tråden.
 */
function Bubbelmeny({
  menyn,
  onStang,
}: {
  readonly menyn: Bubbelmenyn | null;
  readonly onStang: () => void;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const haptik = useHaptik();
  const oppen = menyn !== null;

  return (
    <Modal visible={oppen} transparent animationType="none" onRequestClose={onStang}>
      <Animated.View
        entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
        style={styles.dimmer}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stäng menyn"
          onPress={onStang}
          style={styles.fyll}
        />
      </Animated.View>

      {menyn === null ? null : (
        <>
          <Animated.View
            entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
            pointerEvents="none"
            style={[
              styles.lyft,
              {
                left: menyn.x,
                top: menyn.y,
                width: menyn.bredd,
                transform: [{ scale: rorelse.reducerad ? 1 : 1.03 }],
              },
            ]}
          >
            <View
              style={[
                menyn.egen ? styles.bubbla : styles.lyftsvar,
                menyn.egen
                  ? { backgroundColor: farg['greenSoft'] }
                  : { backgroundColor: farg['card'] },
                styles.lyftbredd,
              ]}
            >
              <Text
                maxFontSizeMultiplier={1.6}
                style={[
                  menyn.egen ? styles.bubbeltext : styles.svarstext,
                  { color: menyn.egen ? farg['onGreenSoft'] : farg['text'] },
                ]}
              >
                {menyn.text}
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
            style={[
              styles.meny,
              {
                top: menyn.y + menyn.hojd + 8,
                backgroundColor: farg['card'],
                borderColor: farg['border'],
              },
              menyn.egen ? { right: 0 } : { left: menyn.x },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kopiera meddelandet"
              onPress={() => {
                void Clipboard.setStringAsync(menyn.text);
                haptik('bekraftelse');
                AccessibilityInfo.announceForAccessibility('Kopierat');
                onStang();
              }}
              style={({ pressed }) => [styles.menyrad, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Rect x={8.5} y={8.5} width={11} height={11} rx={2.5} stroke={farg['text']} strokeWidth={1.9} />
                <Path
                  d="M15.5 5.5h-9a2 2 0 0 0-2 2v9"
                  stroke={farg['text']}
                  strokeWidth={1.9}
                  strokeLinecap="round"
                />
              </Svg>
              <Text maxFontSizeMultiplier={1.4} style={[styles.menytext, { color: farg['text'] }]}>
                Kopiera
              </Text>
            </Pressable>
          </Animated.View>
        </>
      )}
    </Modal>
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
        <View style={styles.valkomstkanin}>
          <AiKaninStor bredd={110} />
        </View>
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

/** Bubblans fulla hörnradie och det lilla hörnet där svansen sitter. */
const BUBBELRADIE = 20;
const SVANSRADIE = 6;

/**
 * 21b: frågan som bubbla till höger (rev-ux 5.2).
 *
 * Svansen sitter bara på gruppens sista bubbla. Kommer ett nytt meddelande
 * flyttas svansen: hörnet rundas med `rm.swap` i stället för att byta
 * utseende på en bildruta.
 */
function Bubbla({
  text,
  tid,
  sist,
  onLangtryck,
}: {
  readonly text: string;
  readonly tid: string;
  readonly sist: boolean;
  readonly onLangtryck: (b: Bubbelmenyn) => void;
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const haptik = useHaptik();
  const ytan = useRef<ComponentRef<typeof View>>(null);
  const svans = useSharedValue(sist ? 1 : 0);

  useEffect(() => {
    svans.value = withTiming(sist ? 1 : 0, {
      duration: rorelse.reducerad ? REDUCERAD_MS : rm.swap,
    });
  }, [sist, rorelse.reducerad, svans]);

  const stil = useAnimatedStyle(() => ({
    borderBottomRightRadius: BUBBELRADIE - (BUBBELRADIE - SVANSRADIE) * svans.value,
  }));

  return (
    <View style={styles.bubbelrad}>
      {/* collapsable={false}: Android mäter inte en vy som optimerats bort. */}
      <View ref={ytan} collapsable={false}>
        <Pressable
          accessibilityRole="text"
          accessibilityLabel={tid === '' ? text : `${text}. ${tid}`}
          accessibilityHint="Långtryck för att kopiera."
          onLongPress={() => {
            ytan.current?.measureInWindow((x, y, bredd, hojd) => {
              haptik('medel');
              onLangtryck({ text, x, y, bredd, hojd, egen: true });
            });
          }}
        >
          <Animated.View style={[styles.bubbla, { backgroundColor: farg['greenSoft'] }, stil]}>
            <View style={styles.bubbelinnehall}>
              <Text
                maxFontSizeMultiplier={1.6}
                style={[styles.bubbeltext, { color: farg['onGreenSoft'] }]}
              >
                {text}
              </Text>
              {tid === '' ? null : (
                <Text
                  maxFontSizeMultiplier={1.3}
                  style={[styles.bubbeltid, { color: farg['onGreenSoft'], opacity: 0.6 }]}
                >
                  {tid}
                </Text>
              )}
            </View>
          </Animated.View>
        </Pressable>
      </View>
    </View>
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
  sist,
  tid = '',
  onLangtryck,
  raknaPa,
  onRaknaPa,
  kallor,
}: {
  readonly text: string;
  readonly stoppat: boolean;
  readonly strommar: boolean;
  /** Sist i sin grupp: kaninen och tiden hör till den här raden (5.2). */
  readonly sist: boolean;
  readonly tid?: string;
  readonly onLangtryck?: (b: Bubbelmenyn) => void;
  readonly raknaPa?: string;
  readonly onRaknaPa?: () => void;
  readonly kallor?: readonly Kalla[];
}): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const haptik = useHaptik();
  const ytan = useRef<ComponentRef<typeof View>>(null);

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
        {/*
          Kaninen står vid gruppens sista svar (direktiv 40 steg 2). De
          tidigare svaren i samma grupp får i stället ett indrag lika brett,
          så att texten ligger på samma linje hela gruppen igenom.
        */}
        {sist ? (
          <AiKaninLiten hojd={KANIN_LITEN_PT} />
        ) : (
          <View style={styles.kaninplats} />
        )}
        <View ref={ytan} collapsable={false} style={styles.fyll}>
          <Pressable
            accessible={false}
            disabled={strommar || onLangtryck === undefined}
            onLongPress={() => {
              if (onLangtryck === undefined) return;
              ytan.current?.measureInWindow((x, y, bredd, hojd) => {
                haptik('medel');
                onLangtryck({ text, x, y, bredd, hojd, egen: false });
              });
            }}
          >
            <Text maxFontSizeMultiplier={1.8} style={[styles.svarstext, { color: farg['text'] }]}>
              {text}
              {strommar ? (
                <Text style={[styles.markor, { color: farg['greenIcon'] }]}>{' ▌'}</Text>
              ) : null}
            </Text>
            {tid === '' ? null : (
              <Text
                maxFontSizeMultiplier={1.3}
                style={[styles.bubbeltid, styles.svarstid, { color: farg['faint'] }]}
              >
                {tid}
              </Text>
            )}
          </Pressable>
        </View>
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
      <AiKaninLiten hojd={KANIN_LITEN_PT} />
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
      ordning * PUNKTFORSKJUTNING_MS,
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
  /**
   * Direktiv 41: samma fråga före borttagning som i Historik.
   *
   * Haptikkartan säger `varning` före en oåterkallelig handling, och ett
   * sparat samtal går inte att få tillbaka. Tillståndet bär sättet att ta
   * bort, så att svepets ihopfällning blir kvar.
   */
  const [tabortfraga, setTabortfraga] = useState<(() => void) | null>(null);
  const haptik = useHaptik();

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
              <Svepbar
                key={s.id}
                etikett={samtalsrubrik(s)}
                onTaBort={() => onTaBort(s.id)}
                bekrafta={(ja) => {
                  haptik('varning');
                  setTabortfraga(() => ja);
                }}
              >
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
          onPress={() => {
            // Varning före frågan, inte efter rensningen (direktiv 41).
            haptik('varning');
            setRensafraga(true);
          }}
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
        oppen={tabortfraga !== null}
        titel="Ta bort samtalet?"
        text="Samtalet tas bort från telefonen. Det går inte att ångra."
        bekraftaTitel="Ta bort"
        onBekrafta={() => {
          const gor = tabortfraga;
          setTabortfraga(null);
          gor?.();
        }}
        onAvbryt={() => setTabortfraga(null)}
      />

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
  huvudnamn: { fontSize: 18, fontFamily: 'Archivo_900Black', includeFontPadding: false, flexShrink: 1 },
  marke: { height: 20, borderRadius: 10, paddingHorizontal: 8, justifyContent: 'center' },
  marketext: { fontSize: 11, fontFamily: 'Archivo_800ExtraBold', includeFontPadding: false },

  valkomst: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
  valkomstspalt: { gap: 10 },
  valkomstkanin: { alignSelf: 'center' },
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

  /*
    Över- och underkant är BYTTA mot vad de ser ut att vara: listans
    contentContainer är vänd en gång (inverterad lista), så `paddingTop`
    hamnar längst ned på skärmen. Luckan mot fältet är alltså 16 och luckan
    mot huvudet 6 — precis som förut.
  */
  trad: { paddingTop: 16, paddingBottom: 6 },
  pillrad: { alignItems: 'center', paddingBottom: 6 },
  pill: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  pilltext: { fontSize: 14, fontFamily: 'Archivo_700Bold', includeFontPadding: false },

  handlingsrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10 },

  /* Mikrofonen och skicka-pilen ligger på samma plats och byter av varandra. */
  platsut: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },

  raknatkort: { borderRadius: 20, borderWidth: 1.5, padding: 16, gap: 2 },
  raknatmarke: {
    fontSize: 11,
    fontFamily: 'Archivo_800ExtraBold',
    letterSpacing: 0.8,
    includeFontPadding: false,
  },
  raknattal: { fontSize: 34, fontFamily: 'Archivo_900Black', includeFontPadding: false },
  raknatenhet: { fontSize: 18, fontFamily: 'Archivo_700Bold', includeFontPadding: false },
  raknatfot: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 4 },
  raknatetikett: { fontSize: 13, lineHeight: 17, fontFamily: 'Archivo_500Medium' },

  /* Långtryckets lyfta kopia och menyn som växer ur bubblan (5.7). */
  lyft: { position: 'absolute', alignItems: 'flex-end' },
  lyftbredd: { maxWidth: '100%' },
  lyftsvar: { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  meny: {
    position: 'absolute',
    minWidth: 170,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    marginHorizontal: 16,
  },
  menyrad: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  menytext: { fontSize: 15, fontFamily: 'Archivo_600SemiBold', includeFontPadding: false },

  datumrad: { alignItems: 'center', paddingVertical: 8 },
  datumtext: {
    fontSize: 12,
    fontFamily: 'Archivo_700Bold',
    letterSpacing: 0.4,
    includeFontPadding: false,
  },
  bubbelrad: { alignItems: 'flex-end' },
  bubbelinnehall: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    columnGap: 8,
  },
  bubbeltid: { fontSize: 11, fontFamily: 'Archivo_600SemiBold', includeFontPadding: false },
  svarstid: { marginTop: 4 },
  kaninplats: { width: kaninLitenBredd(KANIN_LITEN_PT) },
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

  /* Luckan ovanför en rad kommer ur `Tradrad` (lib/chatt-trad.ts). */
  svarsrad: {},
  /* Det levande längst ned: tänker-punkterna och svaret som strömmar. */
  levande: { marginTop: 12 },
  svarsrubrik: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  svarstext: { fontSize: 16, lineHeight: 24, fontFamily: 'Archivo_500Medium' },
  markor: { fontSize: 16 },
  underSvar: { marginTop: 10, marginLeft: SVARSINDRAG },
  kopiera: {
    marginTop: 10,
    marginLeft: SVARSINDRAG,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    paddingRight: 8,
  },
  kopieratext: { fontSize: 13, fontFamily: 'Archivo_600SemiBold', includeFontPadding: false },

  tanker: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kallor: { marginTop: 12, marginLeft: SVARSINDRAG, gap: 6 },
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

  granskort: { borderRadius: 20, padding: 18, gap: 10 },
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
    /* Fem rader: 5 x 22 pt radhojd plus 26 pt luft (rev-ux 5.4). */
    maxHeight: 136,
    borderRadius: 24,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 18,
    paddingRight: 18,
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
