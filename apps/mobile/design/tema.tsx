/**
 * Temat: System, Ljust eller Mörkt, enligt segmentet i Inställningar.
 *
 * Valet ligger i inställningarna (lib/app-state.tsx) och sparas i AsyncStorage,
 * så det överlever omstart. Här översätts det bara till en palett.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, AppState, useColorScheme } from 'react-native';

import { useApp } from '../lib/app-state';
import type { Utseende } from '../lib/lagring';

import { PALETT, type Lage, type Palett } from './tokens';

export type { Utseende };

export interface Tema {
  /** Det läge som faktiskt målas. */
  readonly lage: Lage;
  /** Det användaren valt. */
  readonly utseende: Utseende;
  readonly farg: Palett;
  valjUtseende(utseende: Utseende): void;
}

const TemaContext = createContext<Tema | null>(null);

/**
 * Systemets läge, läst om tills det stämmer.
 *
 * Direktiv 17: det fristående bygget startade i mörkt läge fast telefonen
 * stod på ljust. App-konfigurationen är rätt (`UIUserInterfaceStyle` är
 * `Automatic`) och inget sparat val låg bakom — standardvalet är `system` och
 * läsningen av lagringen är strikt. Kvar står den kända iOS-egenheten: det
 * första `Appearance`-värdet läses medan appen fortfarande startar, och då
 * kan iOS svara med mörkt läge. I utvecklarversionen syns det inte, för där
 * startar JS-koden efter att appen redan ligger framme.
 *
 * `useColorScheme` räcker inte: den lyssnar bara på ÄNDRINGAR, och ändras
 * ingenting kommer startvärdet aldrig att rättas. Därför läses värdet om när
 * appen blir aktiv, och en gång strax efter start.
 */
function useSystemetsLage(): Lage {
  const [lage, setLage] = useState<Lage>(() =>
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );

  /*
    Två källor, ett tillstånd.

    `useColorScheme` prenumererar på ändringar och är snabbast när användaren
    byter läge medan appen är öppen. `Appearance.getColorScheme()` läses om
    flera gånger strax efter start, eftersom det FÖRSTA värdet kan vara fel:
    iOS svarar ibland mörkt medan appen fortfarande startar, och då kommer
    ingen ändringshändelse som rättar det (direktiv 17 och 23).

    Båda skriver till samma tillstånd, så det senaste vi hört gäller. Ett
    värde som inte skiljer sig ger ingen omritning — setState med samma
    värde är gratis i React.
  */
  const fran = useColorScheme();
  useEffect(() => {
    if (fran === 'dark' || fran === 'light') setLage(fran);
  }, [fran]);

  useEffect(() => {
    const las = (): void => {
      setLage(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
    };
    const andring = Appearance.addChangeListener(las);
    const app = AppState.addEventListener('change', (nytt) => {
      if (nytt === 'active') las();
    });
    // Läsningarna strax efter start fångar ett felaktigt startvärde som ingen
    // händelse följer på. Fyra tillfällen räcker gott, och de kostar
    // ingenting: en läsning är ett anrop till en native-getter.
    const nar = [0, 250, 800, 2000];
    const klockor = nar.map((ms) => setTimeout(las, ms));
    return () => {
      andring.remove();
      app.remove();
      for (const k of klockor) clearTimeout(k);
    };
  }, []);

  return lage;
}

export function TemaProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const systemetsLage = useSystemetsLage();
  const { installningar, valjUtseende } = useApp();
  const utseende = installningar.utseende;

  const tema = useMemo<Tema>(() => {
    const lage: Lage = utseende === 'system' ? systemetsLage : utseende;
    return {
      lage,
      utseende,
      farg: PALETT[lage],
      valjUtseende,
    };
  }, [utseende, systemetsLage, valjUtseende]);

  return <TemaContext.Provider value={tema}>{children}</TemaContext.Provider>;
}

export function useTema(): Tema {
  const tema = useContext(TemaContext);
  if (!tema) throw new Error('useTema måste användas inuti TemaProvider.');
  return tema;
}
