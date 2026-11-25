/**
 * Inställningar-fliken: vy 09 och vy 09b (bekräftelsen för Rensa historik).
 *
 * Allt sparas i AsyncStorage. AI-modell och Språk togs bort i design v2 —
 * inget av dem gick att ändra, och en rad som inte går att trycka på är en
 * rad för mycket. Kvar: Valuta, Utseende, Knappvibration, Rensa historik.
 */

import { useState, type ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTema } from '../../design/tema';
import { medFelgrans } from '../../komponenter/Felgrans';
import { Bekraftelsedialog } from '../../komponenter/Dialog';
import { DestruktivKnapp } from '../../komponenter/Knapp';
import { Installningsrad, Segment, Switchrad } from '../../komponenter/Installningsrad';
import { Skarm } from '../../komponenter/Skarm';
import { useApp } from '../../lib/app-state';
import { haptikPaslagen, useHaptik } from '../../lib/rorelse';
import type { Utseende } from '../../lib/lagring';

const UTSEENDEVAL = [
  { varde: 'system', titel: 'System' },
  { varde: 'light', titel: 'Ljust' },
  { varde: 'dark', titel: 'Mörkt' },
] as const satisfies readonly { varde: Utseende; titel: string }[];

function InstallningarSkarm(): ReactNode {
  const { farg } = useTema();
  const haptik = useHaptik();
  const { installningar, satt, valjUtseende, rensa } = useApp();
  const [fragar, setFragar] = useState(false);

  /** Valuta och språk är låsta i den här delen. Säg det, gissa inte. */
  const inteAndringsbart = (vad: string): void => {
    Alert.alert(vad, 'Det här valet kommer i en senare version.');
  };

  return (
    <Skarm rubrik="Inställningar">
      <ScrollView contentContainerStyle={styles.spalt}>
        <View style={[styles.kort, { backgroundColor: farg['card'] }]}>
          <Installningsrad
            titel="Valuta"
            varde={installningar.valuta}
            forst
            onPress={() => inteAndringsbart('Valuta')}
          />
          <Segment
            etikett="Utseende"
            val={UTSEENDEVAL}
            valt={installningar.utseende}
            onValj={valjUtseende}
            forst={false}
          />
          <Switchrad
            titel="Knappvibration"
            pa={installningar.knappvibration}
            forst={false}
            onAndra={(pa) => {
              satt('knappvibration', pa);
              // Slås den på ska det kännas direkt. Slås den av: tyst.
              if (pa) haptikPaslagen();
            }}
          />
        </View>

        <DestruktivKnapp
          titel="Rensa historik"
          onPress={() => {
            // Direktiv 41: varningen kommer FORE frågan, som i Historik och
            // i chattens samtalspanel. Haptikkartan säger varning före en
            // oåterkallelig handling, inte efter att den redan är gjord.
            haptik('varning');
            setFragar(true);
          }}
          ikon={
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 6.5h16M9.5 6.5V4.8h5v1.7M6.8 6.5l.9 12.2a1.5 1.5 0 0 0 1.5 1.4h5.6a1.5 1.5 0 0 0 1.5-1.4l.9-12.2"
                stroke={farg['burn']}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          }
        />
      </ScrollView>

      <Bekraftelsedialog
        oppen={fragar}
        titel="Rensa historik?"
        text="Alla sparade uträkningar tas bort. Det går inte att ångra."
        bekraftaTitel="Rensa historik"
        onAvbryt={() => setFragar(false)}
        onBekrafta={() => {
          rensa();
          setFragar(false);
        }}
      />
    </Skarm>
  );
}

const styles = StyleSheet.create({
  spalt: { gap: 14, paddingBottom: 20 },
  kort: { borderRadius: 20, overflow: 'hidden' },
});

/**
 * Fliken ligger i en felgräns: ett fel i render visar ett kort med felets
 * text i stället för att stänga appen (direktiv 17).
 */
export default medFelgrans(InstallningarSkarm, 'Inställningar');
