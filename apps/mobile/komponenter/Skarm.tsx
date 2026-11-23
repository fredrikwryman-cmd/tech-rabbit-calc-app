/**
 * Appens huvud och skärmens ram.
 *
 * Huvudet är 44 högt med logotypen (24) och appnamnet (15/800), enligt
 * KOMPONENTER.md. Skärmrubriken är screenTitle 30/36/900.
 */

import { useState, type ReactNode } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTema } from '../design/tema';
import { SKARMMARGINAL, SIZE, TEXT } from '../design/tokens';

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
        accessibilityLabel="Tech Rabbit Calc"
        accessibilityHint="Långtryck visar vilken version som körs."
        onLongPress={() => setVisarVersion(true)}
        delayLongPress={700}
      >
        <Logotyp />
      </Pressable>
      <Text style={[TEXT['appName'], styles.appnamn, { color: farg['text'] }]}>
        Tech Rabbit Calc
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
  readonly children?: ReactNode;
}

export function Skarm({ rubrik, stor, vaxlare, children }: SkarmProps): ReactNode {
  const { farg } = useTema();
  const insets = useSafeAreaInsets();

  return (
    <Bakgrund>
      <View style={[styles.innehall, { paddingTop: insets.top }]}>
        <AppHuvud />
        {vaxlare === undefined ? null : <View style={styles.vaxlare}>{vaxlare}</View>}
        {rubrik === undefined ? null : (
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.5}
          style={[
            stor === true ? TEXT['largeTitle'] : TEXT['screenTitle'],
            styles.rubrik,
            { color: farg['text'] },
          ]}
        >
          {rubrik}
        </Text>
        )}
        {/*
          Ett tryck utanfor faltet stanger tangentbordet (direktiv 32).
          Pressable omsluter bara ytan: barnen tar sina egna tryck, sa
          knappar och kort fungerar precis som forut.
        */}
        <Pressable
          accessible={false}
          onPress={() => Keyboard.dismiss()}
          style={styles.yta}
        >
          {children}
        </Pressable>
      </View>
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
});
