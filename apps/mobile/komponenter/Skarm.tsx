/**
 * Appens huvud och skärmens ram.
 *
 * Huvudet är 44 högt med logotypen (24) och appnamnet (15/800), enligt
 * KOMPONENTER.md. Skärmrubriken är screenTitle 30/36/900.
 *
 * ## Direktiv 39: scroll och arklager (rev-ux 4.3 och 4.1)
 *
 * Ramen bär tre beteenden som tidigare inte fanns någonstans:
 *
 * 1. **Kollapsande rubrik.** Skickar skärmen in sin `scroll` krymper och
 *    tonar rubriken med scrollen, och vid ca 60 % tonar en liten version in
 *    i toppfältet i stället.
 * 2. **Toppfältet får avdelare först när innehåll ligger under det**
 *    (scroll > 4 pt). Står listan i topp finns ingen linje att förklara.
 * 3. **Sidan bakom ett ark sjunker** till rm.recedeScale och syns som lager
 *    upptill. Arket självt ligger i en Modal och kan inte göra det åt oss;
 *    lib/ark.tsx är bryggan.
 *
 * Fliksbytet (A11) ligger också här: skärmen tonas in på 160 ms och glider
 * 8 pt uppåt varje gång fliken får fokus.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '../design/tema';
import { SKARMMARGINAL, SIZE, TEXT } from '../design/tokens';
import { useArkOppet } from '../lib/ark';
import { REDUCERAD_MS, rm, useRorelse } from '../lib/rorelse';

import { lasVersion } from '../lib/version';

import { Bakgrund } from './Bakgrund';
import { Logotyp } from './Logotyp';
import { Klarrad } from './Tangentbord';

const HUVUDHOJD = Number(SIZE['headerRow'] ?? 44);

export function AppHuvud(): ReactNode {
  const { farg } = useTema();
  /** Direktiv 18: långtryck på logotypen visar vilken version som körs. */
  const [visarVersion, setVisarVersion] = useState(false);

  return (
    <View style={styles.huvud} accessibilityRole="header">
      <Pressable
        accessibilityLabel="TechRabbit Calc"
        accessibilityHint="Långtryck visar vilken version som körs."
        onLongPress={() => setVisarVersion(true)}
        delayLongPress={700}
      >
        <Logotyp />
      </Pressable>
      <Text style={[TEXT['appName'], styles.appnamn, { color: farg['text'] }]}>
        TechRabbit Calc
      </Text>
      {visarVersion ? <Versionsruta onStang={() => setVisarVersion(false)} /> : null}
    </View>
  );
}

/**
 * Den dolda rutan: uppdaterings-id, runtimeVersion och kanal.
 *
 * ## Varför en Modal
 *
 * Rutan låg förut absolut placerad inuti appens huvud, som är 44 pt högt.
 * Sista raden hamnade då under kortet som ritas efter huvudet i trädet och
 * klipptes bort (sett på telefonen, direktiv 25). En Modal ligger utanför
 * hela skärmens layout, kan inte klippas av något, och får växa med
 * innehållet — också vid stor textstorlek, där raderna blir dubbelt så höga.
 *
 * Ett tryck var som helst stänger. Texten går att markera, så att id:t kan
 * kopieras in i ett meddelande.
 */
function Versionsruta({ onStang }: { readonly onStang: () => void }): ReactNode {
  const { farg } = useTema();
  const v = lasVersion();
  const rader = [
    `Uppdatering: ${v.uppdatering}`,
    `runtimeVersion: ${v.runtime}`,
    `Kanal: ${v.kanal}`,
    ...(v.skapad === '' ? [] : [`Publicerad: ${v.skapad}`]),
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onStang}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Stäng versionsrutan"
        onPress={onStang}
        style={styles.versionsbakgrund}
      >
        <ScrollView
          contentContainerStyle={styles.versionsmitt}
          showsVerticalScrollIndicator={false}
        >
          <View
            accessible
            accessibilityLabel={`Version. ${rader.join('. ')}`}
            style={[
              styles.versionsruta,
              { backgroundColor: farg['card'], borderColor: farg['border'] },
            ]}
          >
            {rader.map((rad) => (
              <Text
                key={rad}
                selectable
                maxFontSizeMultiplier={1.6}
                style={[styles.versionstext, { color: farg['text'] }]}
              >
                {rad}
              </Text>
            ))}
            <Text maxFontSizeMultiplier={1.4} style={[styles.versionsstang, { color: farg['muted'] }]}>
              Tryck för att stänga
            </Text>
          </View>
        </ScrollView>
      </Pressable>
    </Modal>
  );
}

/**
 * Skärmens scrollposition.
 *
 * Skärmen äger värdet och skickar det BÅDE till sin ScrollView (handler) och
 * till Skarm (scroll). Så vet ramen hur långt ned listan är utan att äga
 * listan: rubriken och toppfältet hör till ramen, innehållet till skärmen.
 */
export interface Skarmscroll {
  readonly scroll: SharedValue<number>;
  readonly handler: ReturnType<typeof useAnimatedScrollHandler>;
}

export function useSkarmscroll(): Skarmscroll {
  const scroll = useSharedValue(0);
  const handler = useAnimatedScrollHandler((e) => {
    scroll.value = e.contentOffset.y;
  });
  return { scroll, handler };
}

/** Hur långt rubriken hinner kollapsa. */
const KOLLAPS = 90;
/** rev-ux 4.3: avdelaren kommer när innehåll ligger under toppfältet. */
const AVDELARE_VID = 4;

export interface SkarmProps {
  /** Skärmens rubrik, t.ex. "Historik". Utelämnas på felvyerna 06a och 06b. */
  readonly rubrik?: string;
  /** Sant för largeTitle 34/40, som "Vad vill du räkna?" på Hem. */
  readonly stor?: boolean;
  /**
   * Lägesväxlaren, 6 pt under appens huvud och ovanför rubriken
   * (KOMPONENTER.md v3.1). Utelämnas på de skärmar som inte har någon.
   */
  readonly vaxlare?: ReactNode;
  /**
   * Skärmens scrollposition, från useSkarmscroll(). Skickas den in
   * kollapsar rubriken och toppfältet får sin avdelare (rev-ux 4.3).
   */
  readonly scroll?: SharedValue<number>;
  readonly children?: ReactNode;
}

export function Skarm({ rubrik, stor, vaxlare, scroll, children }: SkarmProps): ReactNode {
  const { farg } = useTema();
  const insets = useSafeAreaInsets();
  const rorelse = useRorelse();
  const arkOppet = useArkOppet();

  /**
   * Sidan bakom ett ark (A3).
   *
   * Skalan tas från rm.recedeScale och går med `smooth`, samma fjäder som
   * arket självt. Med reducerad rörelse står sidan stilla: där är arket en
   * ren toning och det finns inget att sjunka undan för.
   */
  const sank = useSharedValue(1);
  useEffect(() => {
    const mal = arkOppet && !rorelse.reducerad ? rm.recedeScale : 1;
    sank.value = withSpring(mal, rm.smooth);
  }, [arkOppet, rorelse.reducerad, sank]);

  const lager = useAnimatedStyle(() => ({
    transform: [{ scale: sank.value }],
    /* Nedsänkningen förankras upptill: sidan ska synas som ett lager där. */
    opacity: interpolate(sank.value, [rm.recedeScale, 1], [0.92, 1], 'clamp'),
  }));

  /** A11: fliken får fokus — toning 160 ms och 8 pt uppåt. */
  const in_ = useSharedValue(1);
  /*
   * useFocusEffect kor om sin callback varje gang referensen byts, sa den
   * MASTE vara stabil: en inline-funktion ger en ny referens per render och
   * startar toningen om och om igen.
   */
  const reducerad = rorelse.reducerad;
  useFocusEffect(
    useCallback(() => {
      in_.value = 0;
      in_.value = withTiming(1, { duration: reducerad ? REDUCERAD_MS : rm.swap });
    }, [in_, reducerad]),
  );
  const flikbyte = useAnimatedStyle(() => ({
    opacity: in_.value,
    transform: [{ translateY: rorelse.reducerad ? 0 : interpolate(in_.value, [0, 1], [8, 0]) }],
  }));

  /** Rubriken krymper och tonar med scrollen. */
  const rubrikstil = useAnimatedStyle(() => {
    if (scroll === undefined || rorelse.reducerad) return {};
    const y = scroll.value;
    return {
      opacity: interpolate(y, [0, KOLLAPS * 0.6], [1, 0], 'clamp'),
      transform: [
        /* Gummiband överst: rubriken skalas upp max 1.06 (rev-ux 4.3). */
        { scale: interpolate(y, [-80, 0, KOLLAPS], [1.06, 1, 0.86], 'clamp') },
        { translateY: interpolate(y, [0, KOLLAPS], [0, -KOLLAPS * 0.3], 'clamp') },
      ],
    };
  });

  /** Rubriken i miniatyr, inne i toppfältet, från ca 60 %. */
  const minirubrik = useAnimatedStyle(() => {
    if (scroll === undefined || rorelse.reducerad) return { opacity: 0 };
    return {
      opacity: interpolate(scroll.value, [KOLLAPS * 0.5, KOLLAPS * 0.7], [0, 1], 'clamp'),
    };
  });

  /** Avdelaren under toppfältet. */
  const avdelare = useAnimatedStyle(() => {
    if (scroll === undefined) return { opacity: 0 };
    return {
      opacity: interpolate(scroll.value, [0, AVDELARE_VID, 24], [0, 0, 1], 'clamp'),
    };
  });

  return (
    <Bakgrund>
      <Animated.View style={[styles.lager, lager]}>
      <View style={[styles.innehall, { paddingTop: insets.top }]}>
        <View>
          <AppHuvud />
          {/*
            Rubriken i miniatyr tar ingen plats: den ligger ovanpå raden med
            logotypen och tonas in först när den stora rubriken är borta.
          */}
          {rubrik === undefined || scroll === undefined ? null : (
            <Animated.Text
              accessible={false}
              numberOfLines={1}
              maxFontSizeMultiplier={1.4}
              style={[TEXT['appName'], styles.minirubrik, minirubrik, { color: farg['text'] }]}
            >
              {rubrik}
            </Animated.Text>
          )}
          <Animated.View
            style={[styles.avdelare, avdelare, { backgroundColor: farg['border'] }]}
          />
        </View>
        {vaxlare === undefined ? null : <View style={styles.vaxlare}>{vaxlare}</View>}
        {rubrik === undefined ? null : (
        <Animated.Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.5}
          style={[
            stor === true ? TEXT['largeTitle'] : TEXT['screenTitle'],
            styles.rubrik,
            rubrikstil,
            { color: farg['text'] },
          ]}
        >
          {rubrik}
        </Animated.Text>
        )}
        {/*
          Ett tryck utanfor faltet stanger tangentbordet (direktiv 32).
          Pressable omsluter bara ytan: barnen tar sina egna tryck, sa
          knappar och kort fungerar precis som forut.
        */}
        <Animated.View style={[styles.yta, flikbyte]}>
          <Pressable
            accessible={false}
            onPress={() => Keyboard.dismiss()}
            style={styles.yta}
          >
            {children}
          </Pressable>
        </Animated.View>
      </View>
      </Animated.View>
      {/* Raden med Klar, for skarmens falt. */}
      <Klarrad />
    </Bakgrund>
  );
}

const styles = StyleSheet.create({
  innehall: { flex: 1, paddingHorizontal: SKARMMARGINAL },
  vaxlare: { marginTop: 6 },
  huvud: {
    height: HUVUDHOJD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appnamn: { includeFontPadding: false },
  versionsbakgrund: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  versionsmitt: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  versionsruta: {
    // Ingen höjd och ingen absolut placering: rutan växer med raderna.
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  versionsstang: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  // Rutan ar ett verktyg, inte en vy: systemets typsnitt duger.
  versionstext: { fontSize: 12, lineHeight: 17 },
  rubrik: { marginTop: 10, marginBottom: 16 },
  yta: { flex: 1 },
  lager: { flex: 1 },
  /* Miniatyrrubriken ligger i toppfältets högra halva, bortom appnamnet. */
  minirubrik: {
    position: 'absolute',
    right: 0,
    bottom: 10,
    maxWidth: '45%',
    textAlign: 'right',
    includeFontPadding: false,
  },
  avdelare: { height: StyleSheet.hairlineWidth, marginHorizontal: -SKARMMARGINAL },
});
