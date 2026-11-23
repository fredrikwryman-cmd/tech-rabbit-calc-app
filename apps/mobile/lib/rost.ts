/**
 * Röstinmatning: vy 40, 40b och 41 i design v4.
 *
 * Talet känns igen på svenska (sv-SE) och skrivs in i fältet medan man pratar.
 * Ingenting skickas automatiskt — användaren trycker själv på Räkna eller
 * Skicka. Inget ljud sparas och inget ljud lämnar telefonen: `recordingOptions`
 * är aldrig påslaget, så modulen skriver ingen fil, och vår server får bara den
 * text användaren själv skickar iväg.
 *
 * ## Varför modulen laddas lazy
 *
 * `expo-speech-recognition` är en native-modul. `requireNativeModule` körs när
 * filen importeras och KASTAR i Expo Go, där modulen inte finns. En vanlig
 * import hade alltså fällt hela appen vid start i Expo Go. Därför laddas den
 * med `require` inuti en try/catch, första gången någon frågar efter den.
 * Typerna importeras med `import type`, som försvinner vid bygget och aldrig
 * rör native-sidan.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import type { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

/** Metro ger varje modul ett `require`. Det finns inte i TypeScripts typer. */
declare const require: (modul: string) => unknown;

/** Språket. Appen är svensk, så igenkänningen är det också. */
const SPRAK = 'sv-SE';

/**
 * Modulens typ tas ur värdet med `typeof`. Paketet exporterar inte typen för
 * sig, och `import type` försvinner vid bygget — native-sidan rörs aldrig.
 */
type Modul = typeof ExpoSpeechRecognitionModule;

let laddad: Modul | null | undefined;

/**
 * Modulen, eller null när den inte finns (Expo Go, webben, äldre bygge).
 *
 * Svaret sparas: ett misslyckat `require` ska inte göras om vid varje tryck.
 */
export function rostmodul(): Modul | null {
  if (laddad !== undefined) return laddad;
  try {
    const paket = require('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule?: Modul;
    };
    laddad = paket.ExpoSpeechRecognitionModule ?? null;
  } catch {
    laddad = null;
  }
  return laddad;
}

/** Sant när bygget har native-modulen, dvs. inte i Expo Go. */
export function rostFinns(): boolean {
  return rostmodul() !== null;
}

export type Rostlage =
  /** Vilar. */
  | 'av'
  /** Vy 40 / 40b: lyssnar. */
  | 'lyssnar'
  /** Vy 41: behörigheten är nekad. */
  | 'nekad'
  /** Expo Go eller en telefon utan taligenkänning. */
  | 'saknas'
  /** Något gick fel i igenkänningen. */
  | 'fel';

export interface Rost {
  readonly lage: Rostlage;
  /** Ljudnivån 0–1, för vågformen. */
  readonly niva: number;
  /** Startar, eller sätter läget till nekad/saknas i stället. */
  starta: () => void;
  /** Avslutar inspelningen. Texten står kvar i fältet. */
  stoppa: () => void;
  /** Stänger beskedet i vy 41 utan att starta om. */
  nollstall: () => void;
  /** Öppnar appens inställningar i iOS, för vy 41. */
  oppnaInstallningar: () => void;
}

export interface RostProps {
  /**
   * Texten så långt den är känd. Anropas många gånger medan man pratar, med
   * HELA meningen varje gång — inte bara det nya.
   */
  readonly onText: (text: string) => void;
}

/**
 * Hakar upp sig på modulens händelser och sköter behörigheten.
 *
 * Behörigheten frågas först när mikrofonen trycks, aldrig vid start. Nekas
 * den går appen till vy 41, som har vägen till Inställningar. Skrivandet
 * fungerar som vanligt hela tiden.
 */
export function useRost({ onText }: RostProps): Rost {
  const [lage, setLage] = useState<Rostlage>('av');
  const [niva, setNiva] = useState(0);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    const modul = rostmodul();
    if (modul === null) return undefined;

    const resultat = modul.addListener('result', (e) => {
      const text = e.results[0]?.transcript;
      if (typeof text === 'string' && text !== '') onTextRef.current(text);
    });
    const slut = modul.addListener('end', () => {
      setLage((l) => (l === 'lyssnar' ? 'av' : l));
      setNiva(0);
    });
    const fel = modul.addListener('error', (e) => {
      setNiva(0);
      setLage(e.error === 'not-allowed' ? 'nekad' : 'fel');
    });
    const ljud = modul.addListener('volumechange', (e) => {
      // Värdet går från −2 (tyst) till 10 (högt). Vågformen vill ha 0–1.
      setNiva(Math.max(0, Math.min(1, (e.value + 2) / 12)));
    });

    return () => {
      resultat.remove();
      slut.remove();
      fel.remove();
      ljud.remove();
      // Lämnar skärmen mitt i en inspelning ska mikrofonen släppas.
      try {
        modul.abort();
      } catch {
        // Ingen pågående inspelning: inget att avbryta.
      }
    };
  }, []);

  const starta = useCallback(() => {
    const modul = rostmodul();
    if (modul === null) {
      setLage('saknas');
      return;
    }
    void (async () => {
      try {
        if (!modul.isRecognitionAvailable()) {
          setLage('saknas');
          return;
        }
        const svar = await modul.requestPermissionsAsync();
        if (!svar.granted) {
          setLage('nekad');
          return;
        }
        setNiva(0);
        setLage('lyssnar');
        modul.start({
          lang: SPRAK,
          // Texten ska växa fram i fältet medan man pratar.
          interimResults: true,
          // Igenkänningen ska inte sluta vid första pausen: en räknefråga
          // sägs ofta i två andetag.
          continuous: true,
          // På enheten när telefonen stöder det. Gör den inte det faller
          // modulen tillbaka på serverigenkänning av sig själv.
          requiresOnDeviceRecognition: modul.supportsOnDeviceRecognition(),
          // Vågformen behöver nivån. 100 ms räcker gott för 30 bilder/s.
          volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
        });
      } catch {
        setLage('fel');
      }
    })();
  }, []);

  const stoppa = useCallback(() => {
    const modul = rostmodul();
    setNiva(0);
    setLage((l) => (l === 'lyssnar' ? 'av' : l));
    if (modul === null) return;
    try {
      modul.stop();
    } catch {
      // Redan stoppad: ingenting att göra.
    }
  }, []);

  const nollstall = useCallback(() => setLage('av'), []);

  const oppnaInstallningar = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return { lage, niva, starta, stoppa, nollstall, oppnaInstallningar };
}
