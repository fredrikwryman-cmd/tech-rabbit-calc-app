/**
 * Resultat-sheeten, vy 05 i design v2. Öppnas ovanpå Räkna.
 *
 * Ordningen i kortet är ordningen i bilden: etikett, stort tal, villkorsrad,
 * och — när avrundning krävs — raden för praktiskt pris innanför samma kort.
 * Har frågan flera svar ligger de som rader under talet i stället.
 *
 * "Jag räknade med" och "Så räknade jag" är **hopfällda** som standard.
 *
 * Knappraden är designens: Räkna vidare är primär, Dela är liten sekundär och
 * Ny fråga är en textknapp. Har man räknat vidare (05d) ligger det gröna
 * Ändrat-märket ovanför kortet, och prickarna under innehållet visar hur många
 * svar kedjan har. Ett svep åt höger över kortet går tillbaka till det förra
 * svaret — samma riktning som tillbaka i iOS.
 *
 * RORELSE-HAPTIK.md vy 05: sheeten glider upp på 280 ms, siffran tonas in,
 * villkorsraden +80 ms, förklaringen +120 ms. Hopfällda rader ligger stilla.
 * Praktiskt pris tonas in MED kortet — det är en del av svaret.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import type { Faktum, Resultat } from '@techrabbit/engine';

import { useTema } from '../design/tema';
import { SKARMMARGINAL, TEXT } from '../design/tokens';
import { REDUCERAD_MS, rm, useHaptik, useRorelse, YTA_MS } from '../lib/rorelse';
import { useAnmalArk } from '../lib/ark';
import { valjVy } from '../lib/resultatvy';
import { sammanfattaFakta } from '../lib/tolkning';

import { LitenKnapp, PrimarKnapp, Textknapp } from './Knapp';
import { LevandeTal } from './LevandeTal';
import { Vardagsresultat } from './Resultatvyer';
import { DinFragaKort, Stegrad } from './Kort';
import { Harlettvarde, Hopfallbar, Praktisktpris, Redigerbartvarde, Resultatrad, Uppslagsvillkor, Villkorsrad, type Uppslaget } from './Resultatdelar';

/** Avståndet från skärmens överkant, enligt KOMPONENTER.md. */
const TOPP = 62;

/** Momssatserna som går att växla mellan med ett tryck. */
const MOMSSATSER = [25, 12, 6] as const;

export interface ResultatSheetProps {
  readonly oppen: boolean;
  readonly fraga: string;
  readonly etikett: string;
  readonly resultat: Resultat;
  readonly forklaring: string;
  readonly onStang: () => void;
  readonly onNyFraga: () => void;
  /**
   * Räkna om med ändrade värden. Vyn skickar bara de fakta som ändrats, i
   * motorns egna nycklar — den räknar aldrig själv.
   */
  readonly onRaknaOm: (andrade: Readonly<Record<string, string>>) => void;
  /** 05c: öppnar Räkna vidare. */
  readonly onRaknaVidare: () => void;
  /** Vy 10: öppnar delningsvyn. */
  readonly onDela: () => void;
  /** 05d: ändringen som ledde till det här svaret, i användarens egna ord. */
  readonly andrat?: string;
  /** Hur många tidigare svar kedjan har. 0 döljer prickarna och svepet. */
  readonly antalTidigare?: number;
  /** Tillbaka till det förra svaret i kedjan. */
  readonly onForegaende?: () => void;
  /** Direktiv 32: värden tjänsten slog upp, som rättbara villkor. */
  readonly uppslag?: readonly Uppslaget[];
  /** Rättelsen går tillbaka som ett följdsvar på uppslagets fråga. */
  readonly onRattaUppslag?: (fraga: string, varde: string) => void;
  /**
   * Direktiv 36: vem som räknade.
   *
   * Saknas fältet har räknemotorn räknat. Står det 'rabbit-ai' hade motorn
   * inget räknesätt för frågan, och Rabbit AI svarade själv. Då står en
   * märkning över talet, och "Räkna om" visas inte: det finns inget
   * motorsvar att räkna om på.
   */
  readonly kalla?: 'rabbit-ai';
}

export function ResultatSheet(props: ResultatSheetProps): ReactNode {
  const {
    oppen,
    fraga,
    etikett,
    resultat,
    forklaring,
    onStang,
    onNyFraga,
    onRaknaOm,
    onRaknaVidare,
    onDela,
    andrat,
    antalTidigare = 0,
    onForegaende,
    uppslag = [],
    onRattaUppslag,
    kalla,
  } = props;
  const { farg } = useTema();
  const rorelse = useRorelse();
  const haptik = useHaptik();
  const { height } = useWindowDimensions();

  const tid = rorelse.reducerad ? REDUCERAD_MS : YTA_MS;
  const villkor = resultat.villkor ?? [];
  const rader = resultat.rader ?? [];
  const steg = resultat.steps;
  const fakta = useMemo(() => resultat.fakta ?? [], [resultat]);
  const andringsbart = resultat.andringsbart ?? [];

  /**
   * De värden användaren skrivit om. Tom karta betyder "oförändrat".
   * Nollställs när ett nytt resultat kommer in.
   */
  const [andrade, setAndrade] = useState<Record<string, string>>({});
  useEffect(() => setAndrade({}), [resultat]);

  /**
   * Arket (A3, rev-ux 4.1).
   *
   * Upp underifran med smooth-fjadern, och sedan foljer det fingret: dra ar
   * fingrets vag nedat, y arkets egen. Med reducerad rorelse tonas det in i
   * stallet for att glida, och gesten ar avstangd — en yta som inte ror sig
   * kan inte folja ett finger.
   */
  const y = useSharedValue(height);
  const dra = useSharedValue(0);
  const opacitet = useSharedValue(0);
  /** Arkets hojd: vagen det har att falla, och halva vagen till troskeln. */
  const arkhojd = Math.max(1, height - TOPP);

  useEffect(() => {
    if (!oppen) {
      y.value = height;
      dra.value = 0;
      opacitet.value = 0;
      return;
    }
    dra.value = 0;
    if (rorelse.reducerad) {
      y.value = 0;
      opacitet.value = withTiming(1, { duration: REDUCERAD_MS });
    } else {
      opacitet.value = 1;
      y.value = withSpring(0, rm.smooth);
    }
  }, [oppen, height, rorelse.reducerad, y, dra, opacitet]);

  /**
   * haptic success nar svaret landar (direktiv 39 steg 5).
   *
   * Sparren i lib/rorelse.ts gor att den har och den i Rakna-skarmen inte
   * blir tva vibrationer: 80 ms racker for att de ska bli en.
   */
  useEffect(() => {
    if (oppen) haptik('bekraftelse');
    // Bara oppningen ska utlosa den, inte varje ny render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppen]);

  /** Stanger pa riktigt och lagger tillbaka arket, sa nasta oppning ar ren. */
  function stangNer(): void {
    dra.value = 0;
    y.value = height;
    onStang();
  }

  function snappTillbaka(): void {
    haptik('mjuk');
  }

  /**
   * Dra ned stanger; slapp under halva vagen fjadrar tillbaka (4.1 punkt 6).
   *
   * Gesten sitter pa arkets huvud — grabbern och rubrikraden — och inte pa
   * hela arket. Innehallet ar en ScrollView, och tva gester som bada vill ha
   * fingrets lodrata rorelse slass om varje drag.
   */
  const dragning = Gesture.Pan()
    .enabled(!rorelse.reducerad)
    .onUpdate((e) => {
      dra.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (dra.value > arkhojd / 2 || e.velocityY > 900) {
        runOnJS(stangNer)();
        return;
      }
      dra.value = withSpring(0, rm.smooth);
      runOnJS(snappTillbaka)();
    });

  const stil = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value + dra.value }],
    opacity: opacitet.value,
  }));

  /**
   * Morklaggningen bakom arket (rm.recedeDim).
   *
   * Den foljer arkets lage: dras arket ned ljusnar skarmen bakom i samma
   * takt, sa att fingret kanns som det som styr ljuset.
   */
  const dimmer = useAnimatedStyle(() => ({
    opacity: interpolate(y.value + dra.value, [0, arkhojd], [rm.recedeDim, 0], 'clamp'),
  }));

  /**
   * Vad som räknas som härlett.
   *
   * Motorn pekar ut vad som GÅR att ändra. Allt annat i faktalistan är
   * antingen taget rakt ur frågan eller uträknat ur de andra värdena, och
   * ingetdera ska gå att skriva i. `resultat` är svaret självt.
   */
  function harlett(f: Faktum): boolean {
    return f.nyckel === 'resultat' || !andringsbart.includes(f.nyckel);
  }

  /** Momssatsen byts med ett tryck i stället för att skrivas. */
  function nastaMoms(nuvarande: string): string {
    const tal = Number(nuvarande.replace(',', '.'));
    const i = MOMSSATSER.findIndex((s) => Math.abs(s - tal) < 0.01);
    return String(MOMSSATSER[(i + 1) % MOMSSATSER.length] ?? MOMSSATSER[0]);
  }

  /**
   * Direktiv 36: Rabbit AI svarade, inte motorn.
   *
   * Hela skillnaden mot ett vanligt svar är att det INTE är kontrollräknat,
   * och det ska stå där svaret står — inte i en fotnot längst ner.
   */
  const franRabbitAi = kalla === 'rabbit-ai';

  // Ett modellsvar går inte att räkna om: det finns inga fakta motorn äger.
  const kanRaknaOm = !franRabbitAi && Object.keys(andrade).length > 0;

  /**
   * Vilken resultatvy svaret ska visas i (30-33), eller vy 05 som förut.
   *
   * Valet görs ur motorns egna faktumnycklar — se lib/resultatvy.ts. Svaret
   * bär inte vilket räknesätt som användes, och nycklarna är räknesättets
   * signatur.
   */
  const vy = valjVy(resultat);

  /* Sidan bakom sjunker sa lange arket ar oppet. Se lib/ark.tsx. */
  useAnmalArk(oppen);

  /**
   * Svep åt höger = tillbaka till det förra svaret i kedjan (05d).
   *
   * `failOffsetY` lämnar ifrån sig gesten så fort fingret rör sig uppåt eller
   * nedåt: innehållet under ska fortfarande gå att rulla. Funktionen plockas
   * ut i en egen konstant, eftersom `runOnJS` inte kan ta emot något som kan
   * vara undefined inuti en worklet.
   */
  const tillbaka = onForegaende ?? ((): void => undefined);
  const svep = Gesture.Pan()
    .enabled(antalTidigare > 0 && onForegaende !== undefined && !rorelse.reducerad)
    .activeOffsetX([-24, 24])
    .failOffsetY([-14, 14])
    .onEnd((e) => {
      if (e.translationX > 70 || e.velocityX > 700) runOnJS(tillbaka)();
    });

  return (
    <Modal
      visible={oppen}
      transparent
      animationType="none"
      onRequestClose={onStang}
      accessibilityViewIsModal
      statusBarTranslucent
    >
      <View style={styles.rot}>
        {/* Skarmen bakom morknar. Ett tryck utanfor arket stanger det. */}
        <Animated.View style={[styles.dimmer, dimmer]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stäng resultatet"
            onPress={stangNer}
            style={styles.fyllyta}
          />
        </Animated.View>
        <Animated.View style={[styles.sheet, stil, { top: TOPP, backgroundColor: farg['bg'] }]}>
          <GestureDetector gesture={dragning}>
            <View>
          <View style={[styles.grabber, { backgroundColor: farg['controlBorder'] }]} />
          <View style={styles.huvud}>
            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={1.5}
              style={[TEXT['sheetTitle'], { color: farg['text'] }]}
            >
              Resultat
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stäng resultatet"
              onPress={onStang}
              style={[styles.stang, { backgroundColor: farg['track'] }]}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6.5 6.5l11 11M17.5 6.5l-11 11"
                  stroke={farg['text']}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </View>
            </View>
          </GestureDetector>

          <ScrollView
            contentContainerStyle={styles.innehall}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <DinFragaKort fraga={fraga} />

            {/* 05d: vad som ändrades sedan förra svaret. */}
            {andrat !== undefined && andrat !== '' ? (
              <Animated.View
                entering={FadeIn.duration(tid)}
                style={[styles.andrat, { backgroundColor: farg['greenSoft'] }]}
              >
                <Text
                  maxFontSizeMultiplier={1.4}
                  style={[styles.andrattext, { color: farg['onGreenSoft'] }]}
                >
                  {`Ändrat: ${andrat}`}
                </Text>
              </Animated.View>
            ) : null}

            {/*
              Direktiv 36: märkningen står före talet, inte efter.
              Den som läser svaret ska veta vem som räknade det INNAN siffran
              läses, inte efteråt.
            */}
            {franRabbitAi ? (
              <Animated.View
                entering={FadeIn.duration(tid)}
                style={[styles.markning, { backgroundColor: farg['warnSoft'] }]}
              >
                <Text
                  maxFontSizeMultiplier={1.6}
                  style={[TEXT['secondary'], styles.markningstext, { color: farg['warnText'] }]}
                >
                  Svar från Rabbit AI, inte kontrollräknat av räknemotorn
                </Text>
              </Animated.View>
            ) : null}

            {/* ---------------------------------------------- resultatkortet */}
            <GestureDetector gesture={svep}>
              <View>
              {vy !== 'standard' ? (
                <Vardagsresultat sort={vy} resultat={resultat} etikett={etikett} />
              ) : (
              <View style={[styles.kort, { backgroundColor: farg['card'] }]}>
              {/*
                Direktiv 39 steg 5: innehallet kommer i ordningen tal,
                etikett, forklaring, knappar — 35 ms mellan. Ordningen i
                LAYOUTEN ar designens och orord: etiketten star kvar over
                talet. Det som andrats ar vad som kommer forst.
              */}
              <Animated.View entering={FadeIn.duration(tid).delay(rorelse.ordning(1))}>
                <Text
                  maxFontSizeMultiplier={1.6}
                  style={[TEXT['body'], styles.etikett, { color: farg['muted'] }]}
                >
                  {etikett}
                </Text>
              </Animated.View>
              <Animated.View entering={FadeIn.duration(tid)}>
                {/*
                  Svaret ar gront: det ar sidans enda tal som BAR svaret.
                  greenAnswer ar klargront i BADA temana (direktiv 27) — till
                  skillnad fran greenText, som morknar i ljust lage.

                  Direktiv 39 steg 3: talet rullar in siffra for siffra och
                  krymper nar det blir langt (A10). Delningsbilden ritar sitt
                  eget tal i komponenter/Delning.tsx och ar orord.
                */}
                <LevandeTal
                  varde={resultat.formatted}
                  enhet={resultat.unit}
                  etikett={`${etikett}: ${resultat.formatted} ${resultat.unit}`}
                  stil={{ ...TEXT['result'], ...styles.tal, color: farg['greenAnswer'] }}
                  enhetsstil={{ ...TEXT['resultUnit'], color: farg['greenAnswer'] }}
                />
              </Animated.View>

              {villkor.length > 0 ? (
                <Animated.View entering={FadeIn.duration(tid).delay(rorelse.ordning(2))}>
                  {/* De uppslagna villkoren står för sig: de går att rätta. */}
                  <Villkorsrad
                    villkor={villkor.filter((v) => !uppslag.some((u) => u.text === v))}
                  />
                  {onRattaUppslag === undefined ? null : (
                    <Uppslagsvillkor uppslag={uppslag} onRatta={onRattaUppslag} />
                  )}
                </Animated.View>
              ) : null}

              {/*
                Det exakta talet, när svaret är avrundat uppåt för att täcka
                en kostnad. Svaret står stort och grönt; det exakta står litet
                under, för den som vill se var gränsen gick.
              */}
              {resultat.exakt ? (
                <Praktisktpris
                  etikett="Exakt"
                  varde={resultat.exakt.formatted}
                  enhet={resultat.exakt.unit}
                  skal={resultat.exakt.skal}
                />
              ) : null}

              {/* Praktiskt pris tonas in MED kortet, inte efteråt. */}
              {resultat.praktiskt ? (
                <Praktisktpris
                  etikett="Praktiskt pris"
                  varde={resultat.praktiskt.formatted}
                  enhet={resultat.praktiskt.unit}
                  skal={resultat.praktiskt.skal}
                />
              ) : null}

              {/* 1e: satsen är antagen — säg att den går att byta. */}
              {andringsbart.includes('moms') ? (
                <Text
                  maxFontSizeMultiplier={1.6}
                  style={[TEXT['secondary'], styles.ledtrad, { color: farg['muted'] }]}
                >
                  Satsen går att byta under Jag räknade med.
                </Text>
              ) : null}

              {/* Flera svar: en rad per svar, uppifrån och ned, 80 ms mellan. */}
              {rader.length > 0 ? (
                <View style={[styles.rader, { borderTopColor: farg['border'] }]}>
                  {rader.map((r, i) => (
                    <Resultatrad
                      key={r.etikett}
                      etikett={r.etikett}
                      varde={r.formatted}
                      enhet={r.unit}
                      forst={i === 0}
                      fordrojning={160 + i * 80}
                    />
                  ))}
                </View>
              ) : null}
              </View>
              )}
              </View>
            </GestureDetector>

            {/* ------------------------------------------ Jag räknade med */}
            {fakta.length > 0 ? (
              <Hopfallbar
                etikett="Jag räknade med"
                sammanfattning={sammanfattaFakta(resultat)}
                onOppna={(o) => {
                  if (o) haptik('latt');
                }}
              >
                <View>
                  {fakta.map((f, i) =>
                    harlett(f) ? (
                      <Harlettvarde
                        key={f.nyckel}
                        etikett={f.betydelse}
                        varde={andrade[f.nyckel] ?? f.formatted}
                        enhet={f.unit}
                      />
                    ) : f.nyckel === 'moms' ? (
                      <Momsrad
                        key={f.nyckel}
                        etikett={f.betydelse}
                        varde={andrade['moms'] ?? f.formatted}
                        enhet={f.unit}
                        forst={i === 0}
                        onVaxla={() => {
                          haptik('latt');
                          setAndrade((a) => ({
                            ...a,
                            moms: nastaMoms(a['moms'] ?? f.formatted),
                          }));
                        }}
                      />
                    ) : (
                      <Redigerbartvarde
                        key={f.nyckel}
                        etikett={f.betydelse}
                        varde={andrade[f.nyckel] ?? f.formatted}
                        enhet={f.unit}
                        forst={i === 0}
                        onChange={(v) => setAndrade((a) => ({ ...a, [f.nyckel]: v }))}
                      />
                    ),
                  )}
                  {kanRaknaOm ? (
                    <View style={styles.raknaOm}>
                      <PrimarKnapp titel="Räkna om" onPress={() => onRaknaOm(andrade)} />
                    </View>
                  ) : null}
                </View>
              </Hopfallbar>
            ) : null}

            {/* ------------------------------------------------ förklaring */}
            <Animated.View
              entering={FadeIn.duration(tid).delay(rorelse.ordning(3))}
              style={[styles.kort, { backgroundColor: farg['card'] }]}
            >
              <Text
                maxFontSizeMultiplier={1.6}
                style={[TEXT['sectionLabel'], styles.versal, styles.forklaringsetikett, { color: farg['muted'] }]}
              >
                Förklaring
              </Text>
              <Text maxFontSizeMultiplier={1.8} style={[TEXT['body'], { color: farg['text'] }]}>
                {forklaring}
              </Text>
            </Animated.View>

            {/* ------------------------------------------- Så räknade jag */}
            {steg.length > 0 ? (
              <Hopfallbar
                etikett="Så räknade jag"
                hoger={`${steg.length} steg`}
              >
                <View style={[styles.stegkort, { backgroundColor: farg['bg'] }]}>
                  {steg.map((s, i) => (
                    <Stegrad
                      key={s.nr}
                      nr={s.nr}
                      uttryck={s.uttryck}
                      resultat={`= ${s.resultat}`}
                      forst={i === 0}
                      // Hopfällt innehåll ligger stilla: ingen fördröjning.
                      fordrojning={0}
                    />
                  ))}
                </View>
              </Hopfallbar>
            ) : null}

            {/* 05d: ett svar per prick, det sista är det som visas. */}
            {antalTidigare > 0 ? (
              <View
                accessibilityLabel={`Svar ${antalTidigare + 1} av ${antalTidigare + 1}`}
                accessibilityHint="Svep åt höger för föregående svar"
                style={styles.prickrad}
              >
                {Array.from({ length: antalTidigare + 1 }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.prick,
                      {
                        backgroundColor:
                          i === antalTidigare ? farg['greenIcon'] : farg['controlBorder'],
                      },
                    ]}
                  />
                ))}
                <Text
                  maxFontSizeMultiplier={1.4}
                  style={[TEXT['meta'], styles.prickText, { color: farg['muted'] }]}
                >
                  Svep för föregående
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <Animated.View
            entering={FadeIn.duration(tid).delay(rorelse.ordning(4))}
            style={styles.fot}
          >
            {/*
              "Räkna vidare" lägger till en ändring och låter MOTORN räkna om
              hela frågan. Ett svar motorn inte kunde räkna går inte att
              bygga vidare på, så knappen vore en återvändsgränd. Ny fråga
              och Dela ligger kvar.
            */}
            {franRabbitAi ? null : (
              <PrimarKnapp titel="Räkna vidare" onPress={onRaknaVidare} />
            )}
            <View style={styles.fotrad}>
              <LitenKnapp
                titel="Dela"
                onPress={onDela}
                ikon={<IkonDela farg={farg['text'] ?? '#000'} />}
              />
              <Textknapp titel="Ny fråga" onPress={onNyFraga} />
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Delningsikonen: en pil upp ur en låda, som i iOS. */
function IkonDela({ farg }: { readonly farg: string }): ReactNode {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v12M12 3L8 7M12 3l4 4"
        stroke={farg}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
        stroke={farg}
        strokeWidth={2.1}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Momssatsen: ett tryck byter sats i stället för ett tangentbord.
 *
 * Satserna är tre och kända, så ett fält vore fel verktyg. Raden ser ut som
 * ett redigerbart värde men beter sig som en växlingsknapp.
 */
function Momsrad({
  etikett,
  varde,
  enhet,
  forst,
  onVaxla,
}: {
  readonly etikett: string;
  readonly varde: string;
  readonly enhet: string;
  readonly forst: boolean;
  readonly onVaxla: () => void;
}): ReactNode {
  const { farg } = useTema();
  return (
    <View
      style={[
        styles.momsrad,
        forst ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: farg['border'] },
      ]}
    >
      <Text maxFontSizeMultiplier={1.4} style={[TEXT['rowTitle'], styles.fyll, { color: farg['text'] }]}>
        {etikett}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${etikett} ${varde} ${enhet}`}
        accessibilityHint="Byter till nästa momssats"
        onPress={onVaxla}
        // Knappen ar 40 pt hog; hitSlop gor traffytan 48.
        hitSlop={4}
        style={({ pressed }) => [
          styles.momsknapp,
          {
            backgroundColor: farg['inset'],
            borderColor: farg['controlBorder'],
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text maxFontSizeMultiplier={1.4} style={[TEXT['input'], { color: farg['text'] }]}>
          {varde}
        </Text>
        <Text maxFontSizeMultiplier={1.3} style={[TEXT['meta'], { color: farg['muted'] }]}>
          {enhet}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rot: { flex: 1 },
  fyll: { flex: 1 },
  fyllyta: { flex: 1 },
  /* Morklaggningen bakom arket. Styrkan kommer ur rm.recedeDim. */
  dimmer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#000' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 16,
  },
  grabber: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 10 },
  huvud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SKARMMARGINAL,
    paddingBottom: 12,
  },
  stang: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  innehall: { paddingHorizontal: SKARMMARGINAL, paddingBottom: 20, gap: 14 },
  versal: { textTransform: 'uppercase', letterSpacing: 0.6 },

  kort: { borderRadius: 20, padding: 18 },
  etikett: { marginBottom: 2 },
  talrad: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  tal: { letterSpacing: -1 },
  rader: { marginTop: 13, paddingTop: 2, borderTopWidth: StyleSheet.hairlineWidth },
  ledtrad: { marginTop: 10 },
  forklaringsetikett: { marginBottom: 8 },

  raknaOm: { marginTop: 14 },
  stegkort: { borderRadius: 14, overflow: 'hidden', marginTop: 4 },

  momsrad: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  momsknapp: {
    minWidth: 86,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    paddingHorizontal: 12,
  },

  fot: { paddingHorizontal: SKARMMARGINAL, paddingTop: 10, paddingBottom: 34, gap: 12 },
  fotrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  andrat: {
    alignSelf: 'flex-start',
    minHeight: 26,
    borderRadius: 13,
    paddingHorizontal: 11,
    justifyContent: 'center',
  },
  andrattext: { fontSize: 12, fontFamily: 'Archivo_800ExtraBold', includeFontPadding: false },

  /*
   * Direktiv 36: märkningen är en hel rad, inte en liten pill.
   *
   * Ett Ändrat-märke är en upplysning man kan missa. Att svaret inte är
   * kontrollräknat får man inte missa, så raden är lika bred som kortet och
   * texten är läsbar i brödtextstorlek.
   */
  markning: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  markningstext: { includeFontPadding: false },

  prickrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  prick: { width: 7, height: 7, borderRadius: 4 },
  prickText: { marginLeft: 6 },
});
