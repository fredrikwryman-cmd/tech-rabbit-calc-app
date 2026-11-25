/**
 * Vägen ut ur tangentbordet.
 *
 * Sett på telefonen (direktiv 32): sifferknappsatsen täckte Skicka och Räkna,
 * och gick inte att stänga. Enda vägen ut var att skicka frågan. En
 * knappsats utan returtangent MÅSTE därför ha en egen rad med Klar.
 *
 * `InputAccessoryView` är inbyggt i React Native och finns bara på iOS. Den
 * ritas ovanför tangentbordet och hör till det fält som pekar på den med
 * `inputAccessoryViewID`. Raden ligger alltså aldrig i vägen när
 * tangentbordet är nere.
 *
 * ## Varför flera id
 *
 * Ett `nativeID` hör till ett träd. Ett fält inne i en modal ser inte en rad
 * som ritats utanför modalen, så varje värd ritar sin egen: skärmen, arken
 * (bara ett ark är öppet i taget), chatten och chattens panel. Fältet pekar
 * på sin värds id, och ingen rad ritas två gånger i samma träd.
 */

import type { ReactNode } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { useTema } from '../design/tema';
import { TEXT } from '../design/tokens';

/**
 * KeyboardAvoidingView-beteendet (direktiv 33, omgjort i direktiv 41).
 *
 * Direktiv 41: vyerna använder nu `KeyboardAvoidingView` ur
 * react-native-keyboard-controller i stället för React Natives egen. Den
 * följer tangentbordets exakta kurva och gör det LIKA på iOS och Android,
 * så beteendet behöver inte längre skilja sig per plattform: `padding`
 * gäller båda. (Direktiv 33 fick sätta `height` på Android eftersom RN:s
 * egen vy inte flyttade någonting där.)
 *
 * `softwareKeyboardLayoutMode: "resize"` ligger kvar i app.json: fönstret
 * ska fortsätta krympa, annars har ingenting att följa.
 *
 * Konstanten står på ett ställe: fyra vyer läste förut samma ternär, och
 * fyra kopior hade kunnat glida isär.
 */
export const TANGENTBORDSBETEENDE = 'padding';

/** Skärmarna: frågefältet och svarsfältet. */
export const KLAR_ID = 'tr-klar-skarm';
/** Arken: Räkna vidare och ändringsfälten i resultatet. */
export const KLAR_ID_ARK = 'tr-klar-ark';
/** Chattens fält. */
export const KLAR_ID_CHAT = 'tr-klar-chat';
/** Chattens panel: sökfältet bland samtalen. */
export const KLAR_ID_PANEL = 'tr-klar-panel';

/**
 * Raden med Klar. Stänger tangentbordet utan att skicka något.
 *
 * Returnerar null på allt utom iOS: Android har en egen bakåtväg ur
 * tangentbordet, och en extra rad där vore en rad för mycket.
 */
export function Klarrad({ id = KLAR_ID }: { readonly id?: string }): ReactNode {
  const { farg } = useTema();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={id}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Klar"
        accessibilityHint="Stänger tangentbordet utan att skicka."
        onPress={() => Keyboard.dismiss()}
        style={({ pressed }) => [
          styles.rad,
          {
            backgroundColor: farg['card'],
            borderTopColor: farg['border'],
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text maxFontSizeMultiplier={1.4} style={[TEXT['button'], { color: farg['greenIcon'] }]}>
          Klar
        </Text>
      </Pressable>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  rad: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    // 44 pt: samma minsta träffyta som allt annat man trycker på.
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
  },
});
