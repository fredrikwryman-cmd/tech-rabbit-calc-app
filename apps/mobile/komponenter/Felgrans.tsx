/**
 * Felgränsen runt varje flik.
 *
 * Ett fel i render eller i en effekt fäller hela appen i ett riktigt bygge —
 * i utvecklarversionen blir det en röd skärm man kan läsa, men i det
 * fristående bygget stängs appen utan ett ord. Direktiv 17: hellre ett kort
 * med felets text, så att felet går att se på telefonen.
 *
 * Komponenten är en klass, för `getDerivedStateFromError` finns inte som
 * hook. Den fångar INTE fel i händelsehanterare som körs utanför render —
 * de är ändå inte en vit skärm, utan ett tryck som inte gör något.
 *
 * Kortet läser temat direkt ur systemet i stället för ur TemaProvider: om
 * det är temat som är trasigt ska felkortet ändå gå att läsa.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

interface Props {
  /** Flikens namn, så att Fredrik ser VAR felet kom. */
  readonly namn: string;
  readonly children: ReactNode;
}

interface State {
  readonly fel: Error | null;
}

export class Felgrans extends Component<Props, State> {
  override state: State = { fel: null };

  static getDerivedStateFromError(fel: Error): State {
    return { fel };
  }

  override componentDidCatch(fel: Error, info: ErrorInfo): void {
    // Loggen följer med i Xcode och i eas-loggarna.
    console.error(`Fel i fliken ${this.props.namn}:`, fel, info.componentStack);
  }

  override render(): ReactNode {
    const { fel } = this.state;
    if (fel === null) return this.props.children;
    return (
      <Felkort namn={this.props.namn} fel={fel} onForsokIgen={() => this.setState({ fel: null })} />
    );
  }
}

function Felkort({
  namn,
  fel,
  onForsokIgen,
}: {
  readonly namn: string;
  readonly fel: Error;
  readonly onForsokIgen: () => void;
}): ReactNode {
  const morkt = useColorScheme() === 'dark';
  const bg = morkt ? '#0B0B0B' : '#F2F2F2';
  const kort = morkt ? '#1A1A1A' : '#FFFFFF';
  const text = morkt ? '#F2F2F2' : '#121212';
  const dampad = morkt ? '#A8A8A8' : '#5A5A5A';

  // Första raderna räcker: resten är ramverkets egen stack.
  const stack = (fel.stack ?? '').split('\n').slice(0, 4).join('\n');

  return (
    <View style={[styles.rot, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.innehall}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={[styles.rubrik, { color: text }]}>
          {`Något gick fel i ${namn}`}
        </Text>
        <Text maxFontSizeMultiplier={1.6} style={[styles.brod, { color: dampad }]}>
          Appen stängs inte. Texten nedan är felet, precis som det kom.
        </Text>
        <View style={[styles.kort, { backgroundColor: kort }]}>
          <Text selectable maxFontSizeMultiplier={1.6} style={[styles.felrad, { color: text }]}>
            {fel.message === '' ? String(fel) : fel.message}
          </Text>
          {stack === '' ? null : (
            <Text selectable maxFontSizeMultiplier={1.4} style={[styles.stack, { color: dampad }]}>
              {stack}
            </Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Försök igen"
          onPress={onForsokIgen}
          style={({ pressed }) => [
            styles.knapp,
            { backgroundColor: kort, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text maxFontSizeMultiplier={1.6} style={[styles.knapptext, { color: text }]}>Försök igen</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** Lindar en flikskärm. Används som default-export i app/(tabs)/. */
export function medFelgrans<P extends object>(
  Skarm: (props: P) => ReactNode,
  namn: string,
): (props: P) => ReactNode {
  return function MedFelgrans(props: P): ReactNode {
    return (
      <Felgrans namn={namn}>
        <Skarm {...props} />
      </Felgrans>
    );
  };
}

const styles = StyleSheet.create({
  rot: { flex: 1 },
  innehall: { padding: 20, gap: 12, paddingTop: 80 },
  // Felkortet har inga tokens och inget Archivo: det ska gå att visa aven
  // nar temat eller typsnitten ar det som gatt fel.
  rubrik: { fontSize: 22, fontWeight: '800' },
  brod: { fontSize: 15, lineHeight: 21 },
  kort: { borderRadius: 16, padding: 16, gap: 10 },
  felrad: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  stack: { fontSize: 12, lineHeight: 17 },
  knapp: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  knapptext: { fontSize: 17, fontWeight: '800' },
});
