/**
 * En rad i historiken, vy 07.
 *
 * KOMPONENTER.md: min 84, padding 12/16, fråga 15/500 på en rad, resultat
 * 17/900, datum 12. Svept visar Ta bort, 96 pt brett i burnFill. …-menyn är
 * 44 × 44.
 *
 * Svepet ligger i Svepbar, som samtalsraderna i 21f delar.
 *
 * ## Varför menyn ligger i en Modal
 *
 * Menyn låg tidigare absolut placerad inuti raden. Både raden (som måste
 * klippa svepet) och kortet runt listan har `overflow: hidden`, så menyn blev
 * avklippt nedtill — sett på telefonen i direktiv 15. En Modal ligger utanför
 * bådas klippning, och menyn placeras där knappen faktiskt står på skärmen.
 */

import { useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewInstance,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTema } from '../design/tema';
import { TEXT } from '../design/tokens';
import { REDUCERAD_MS, useHaptik, useRorelse, YTA_MS } from '../lib/rorelse';

import { Bekraftelsedialog } from './Dialog';
import { IkonPapperskorg, Svepbar } from './Svepbar';

/** Menyrutans ungefärliga höjd, för att välja över eller under knappen. */
const MENYHOJD = 56;

function IkonMeny({ farg }: { readonly farg: string }): ReactNode {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {[6, 12, 18].map((x) => (
        <Circle key={x} cx={x} cy={12} r={1.7} fill={farg} />
      ))}
    </Svg>
  );
}

export interface HistorikradProps {
  readonly fraga: string;
  readonly resultat: string;
  readonly datum: string;
  readonly forst: boolean;
  readonly onPress: () => void;
  readonly onTaBort: () => void;
}

export function Historikrad({
  fraga,
  resultat,
  datum,
  forst,
  onPress,
  onTaBort,
}: HistorikradProps): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const haptik = useHaptik();
  const skarm = useWindowDimensions();
  const menyknappen = useRef<ViewInstance>(null);
  /** Var menyn ska ritas på skärmen, eller null när den är stängd. */
  const [meny, setMeny] = useState<{ hoger: number; topp: number } | null>(null);
  /**
   * Direktiv 41: raden frågar innan den tas bort.
   *
   * Tillståndet bär SÄTTET att ta bort, inte bara ett ja eller nej: svepet
   * vill fälla ihop raden först, menyn tar bort direkt. En dialog, två
   * vägar in, och ingen risk att de två svarar olika.
   */
  const [fragan, setFragan] = useState<(() => void) | null>(null);

  const bekraftaBorttagning = (gor: () => void): void => {
    // Haptiken före en oåterkallelig handling (rev-ux haptikkartan).
    haptik('varning');
    setFragan(() => gor);
  };

  /** Mäter knappen i fönstret och lägger menyn under den — eller över. */
  const oppnaMeny = (): void => {
    menyknappen.current?.measureInWindow((x, y, bredd, hojd) => {
      const under = y + hojd + 6;
      const overKanten = under + MENYHOJD > skarm.height - 24;
      setMeny({
        hoger: Math.max(8, skarm.width - (x + bredd)),
        topp: overKanten ? Math.max(24, y - MENYHOJD - 6) : under,
      });
    });
  };

  return (
    <>
      <Svepbar etikett={fraga} onTaBort={onTaBort} bekrafta={bekraftaBorttagning}>
        {(stangOmOppen) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${fraga}. ${resultat}. ${datum}`}
            accessibilityHint="Öppnar uträkningen."
            onPress={() => {
              if (!stangOmOppen()) onPress();
            }}
            style={[
              styles.rad,
              { backgroundColor: farg['card'] },
              forst
                ? null
                : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: farg['border'] },
            ]}
          >
            <View style={styles.text}>
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.6}
                style={[TEXT['secondary'], styles.fraga, { color: farg['text'] }]}
              >
                {fraga}
              </Text>
              {/* Radens tal ÄR huvudsvaret: klargrönt i båda temana (direktiv 27). */}
              <Text maxFontSizeMultiplier={1.6} style={[styles.resultat, { color: farg['greenAnswer'] }]}>
                {resultat}
              </Text>
              <Text maxFontSizeMultiplier={1.4} style={[TEXT['meta'], { color: farg['muted'] }]}>
                {datum}
              </Text>
            </View>

            <Pressable
              ref={menyknappen}
              accessibilityRole="button"
              accessibilityLabel={`Fler val för ${fraga}`}
              accessibilityState={{ expanded: meny !== null }}
              onPress={oppnaMeny}
              hitSlop={8}
              style={styles.meny}
            >
              <IkonMeny farg={farg['muted'] ?? '#000'} />
            </Pressable>
          </Pressable>
        )}
      </Svepbar>

      <Modal
        visible={meny !== null}
        transparent
        animationType="none"
        onRequestClose={() => setMeny(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stäng menyn"
          onPress={() => setMeny(null)}
          style={styles.utanfor}
        />
        {meny === null ? null : (
          <Animated.View
            entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
            style={[
              styles.menyruta,
              {
                right: meny.hoger,
                top: meny.topp,
                backgroundColor: farg['card'],
                borderColor: farg['border'],
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ta bort ${fraga}`}
              onPress={() => {
                setMeny(null);
                bekraftaBorttagning(onTaBort);
              }}
              style={styles.menyval}
            >
              <IkonPapperskorg farg={farg['burn'] ?? '#000'} storlek={18} />
              <Text maxFontSizeMultiplier={1.6} style={[TEXT['rowTitle'], { color: farg['burn'] }]}>
                Ta bort
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </Modal>

      <Bekraftelsedialog
        oppen={fragan !== null}
        titel="Ta bort uträkningen?"
        text="Raden tas bort från telefonen. Det går inte att ångra."
        bekraftaTitel="Ta bort"
        onBekrafta={() => {
          const gor = fragan;
          setFragan(null);
          gor?.();
        }}
        onAvbryt={() => setFragan(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  rad: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  text: { flex: 1, gap: 2 },
  fraga: { fontSize: 15 },
  resultat: { fontSize: 17, fontFamily: 'Archivo_900Black', includeFontPadding: false },
  meny: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  utanfor: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  menyruta: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    // Menyn ligger ovanpå kortet och ska se ut att göra det.
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  menyval: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
});
