/**
 * Räkna vidare: vy 05c i design v2.
 *
 * Från ett svar bygger man vidare på resultatet utan att skriva om frågan.
 * Vyn visar vad svaret är NU, frågar vad som ska ändras, och lämnar texten
 * till Räkna-flikens vanliga räkning: motorn räknar, AI:n tolkar. Vyn räknar
 * ingenting själv och känner inget API.
 *
 * KOMPONENTER.md: "Nu"-raden ligger i ett inset-kort, rubriken är 22/28 900,
 * fältet är minst 120 högt med radie 20 och 2 pt greenIcon-kant, och
 * förslagen är märken 30 höga med radie 15.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';

import { KLAR_ID_ARK } from './Tangentbord';
import { useTema } from '../design/tema';
import { TEXT } from '../design/tokens';
import { useHaptik } from '../lib/rorelse';
import { VIDARE_FORSLAG } from '../lib/vidare';

import { PrimarKnapp } from './Knapp';
import { Sheet } from './Sheet';

export interface RaknaVidareSheetProps {
  readonly oppen: boolean;
  /** Svaret som det ser ut nu, t.ex. "2,88" och "kr/st". */
  readonly varde: string;
  readonly enhet: string;
  readonly onStang: () => void;
  /** Ändringen i användarens egna ord. Räkna-fliken gör om frågan. */
  readonly onRakna: (andring: string) => void;
}

export function RaknaVidareSheet(props: RaknaVidareSheetProps): ReactNode {
  const { oppen, varde, enhet, onStang, onRakna } = props;
  const { farg } = useTema();
  const haptik = useHaptik();
  const [text, setText] = useState('');
  const faltet = useRef<TextInputInstance>(null);

  // Varje gång vyn öppnas börjar den tom: en gammal ändring hör till ett
  // gammalt svar.
  useEffect(() => {
    if (oppen) setText('');
  }, [oppen]);

  const kanRakna = text.trim().length > 0;

  return (
    <Sheet
      oppen={oppen}
      titel="Räkna vidare"
      onStang={onStang}
      fot={
        <PrimarKnapp
          titel="Räkna om"
          inaktiv={!kanRakna}
          onPress={() => {
            if (!kanRakna) return;
            onRakna(text.trim());
          }}
        />
      }
    >
      <View style={[styles.nu, { backgroundColor: farg['inset'] }]}>
        <Text
          maxFontSizeMultiplier={1.4}
          style={[TEXT['sectionLabel'], styles.versal, { color: farg['faint'] }]}
        >
          Nu
        </Text>
        <View style={styles.nurad}>
          <Text maxFontSizeMultiplier={1.4} style={[styles.nuvarde, { color: farg['text'] }]}>
            {varde}
          </Text>
          <Text maxFontSizeMultiplier={1.3} style={[TEXT['meta'], { color: farg['muted'] }]}>
            {enhet}
          </Text>
        </View>
      </View>

      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.5}
        style={[styles.rubrik, { color: farg['text'] }]}
      >
        Vad vill du ändra?
      </Text>

      <TextInput
        ref={faltet}
        value={text}
        onChangeText={setText}
        multiline
        placeholder="T.ex. och om tio blir osålda?"
        placeholderTextColor={farg['faint']}
        accessibilityLabel="Vad vill du ändra?"
        maxFontSizeMultiplier={1.6}
        style={[
          styles.falt,
          TEXT['input'],
          {
            backgroundColor: farg['card'],
            borderColor: farg['greenIcon'],
            color: farg['text'],
          },
        ]}
        inputAccessoryViewID={KLAR_ID_ARK}
      />

      <View style={styles.forslagsrad}>
        {VIDARE_FORSLAG.map((f) => (
          <Pressable
            key={f}
            accessibilityRole="button"
            accessibilityLabel={`Lägg till ${f}`}
            // Market ar 30 pt hogt; hitSlop gor traffytan 46.
            hitSlop={8}
            onPress={() => {
              haptik('latt');
              // Förslaget läggs TILL det som redan står, så att två förslag
              // går att kombinera. Fältet är användarens, inte vårt.
              setText((n) => (n.trim() === '' ? f : `${n.trim()} ${f}`));
              faltet.current?.focus();
            }}
            style={({ pressed }) => [
              styles.marke,
              {
                backgroundColor: farg['card'],
                borderColor: farg['controlBorder'],
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text maxFontSizeMultiplier={1.4} style={[styles.marketext, { color: farg['text'] }]}>
              {f}
            </Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  nu: { borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16, gap: 2 },
  versal: { textTransform: 'uppercase', letterSpacing: 0.6 },
  nurad: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  nuvarde: { fontSize: 18, lineHeight: 23, fontFamily: 'Archivo_800ExtraBold' },
  rubrik: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'Archivo_900Black',
    letterSpacing: -0.4,
    marginTop: 4,
  },
  falt: {
    minHeight: 120,
    borderRadius: 20,
    borderWidth: 2,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    textAlignVertical: 'top',
  },
  forslagsrad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  marke: {
    minHeight: 30,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  marketext: { fontSize: 13, fontFamily: 'Archivo_600SemiBold' },
});
