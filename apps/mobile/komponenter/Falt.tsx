/**
 * Frågefältet och svarsfältet.
 *
 * Frågefält: min 150, radie 20, padding 16/18, 18/25 500, kant 1,5 border som
 * blir 2 greenIcon vid fokus (KOMPONENTER.md).
 * Svarsfält: höjd 56, radie 14, enheten till höger, kant 2 greenIcon.
 *
 * Frågefältet bär mikrofonen (vy 20 och 40). Den ligger i fältets nedre högra
 * hörn och syns bara när anroparen skickar med den: felvyerna och
 * följdfrågorna har ingen röst.
 */

import { forwardRef, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';

import { useTema } from '../design/tema';
import { TEXT } from '../design/tokens';

export interface FragefaltProps {
  readonly varde: string;
  readonly onChange: (v: string) => void;
  readonly fokus: boolean;
  readonly onFokus: (pa: boolean) => void;
  readonly platshallare?: string;
  /** Mikrofonknappen, när fältet ska ha en. */
  readonly mikrofon?: ReactNode;
  /** Sant medan rösten spelar in: kanten blir 2 pt greenIcon (vy 40). */
  readonly lyssnar?: boolean;
}

export const Fragefalt = forwardRef<TextInputInstance, FragefaltProps>(function Fragefalt(
  {
    varde,
    onChange,
    fokus,
    onFokus,
    platshallare = 'Skriv eller prata in din fråga …',
    mikrofon,
    lyssnar,
  },
  ref,
): ReactNode {
  const { farg } = useTema();
  const markerad = fokus || lyssnar === true;
  return (
    <View
      style={[
        styles.fraga,
        {
          backgroundColor: farg['card'],
          borderWidth: markerad ? 2 : 1.5,
          borderColor: markerad ? farg['greenIcon'] : farg['border'],
        },
      ]}
    >
      <TextInput
        ref={ref}
        multiline
        value={varde}
        onChangeText={onChange}
        onFocus={() => onFokus(true)}
        onBlur={() => onFokus(false)}
        placeholder={platshallare}
        placeholderTextColor={farg['faint']}
        accessibilityLabel="Din fråga"
        accessibilityHint="Skriv vad du vill räkna ut, på vanlig svenska."
        maxFontSizeMultiplier={1.8}
        textAlignVertical="top"
        style={[TEXT['input'], styles.fragetext, { color: farg['text'] }]}
      />
      {mikrofon === undefined ? null : <View style={styles.mikplats}>{mikrofon}</View>}
    </View>
  );
});

export interface SvarsfaltProps {
  readonly varde: string;
  readonly onChange: (v: string) => void;
  readonly enhet: string;
  /** Frågan ovanför fältet, som VoiceOver-etikett. */
  readonly etikett: string;
  readonly autoFokus?: boolean;
}

export const Svarsfalt = forwardRef<TextInputInstance, SvarsfaltProps>(function Svarsfalt(
  { varde, onChange, enhet, etikett, autoFokus },
  ref,
): ReactNode {
  const { farg } = useTema();
  return (
    <View
      style={[
        styles.svar,
        { backgroundColor: farg['inset'], borderWidth: 2, borderColor: farg['greenIcon'] },
      ]}
    >
      <TextInput
        ref={ref}
        value={varde}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        autoFocus={autoFokus}
        accessibilityLabel={etikett}
        accessibilityHint={`Svaret anges i ${enhet}.`}
        maxFontSizeMultiplier={1.6}
        style={[TEXT['resultUnit'], styles.svarstext, { color: farg['text'] }]}
      />
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        maxFontSizeMultiplier={1.4}
        style={[TEXT['stepMath'], { color: farg['muted'] }]}
      >
        {enhet}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  fraga: { minHeight: 150, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 18 },
  fragetext: { flex: 1, padding: 0, includeFontPadding: false },
  mikplats: { alignItems: 'flex-end', marginTop: 8 },
  svar: {
    minHeight: 56,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  svarstext: { flex: 1, padding: 0, includeFontPadding: false },
});
