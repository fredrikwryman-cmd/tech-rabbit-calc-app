/**
 * Appens delade tillstånd: inställningarna och historiken.
 *
 * Båda ligger i AsyncStorage (lagring.ts) och läses en gång vid start.
 * Temat (design/tema.tsx) läser utseendet härifrån.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  lasHistorik,
  lasInstallningar,
  skrivHistorik,
  skrivInstallningar,
  STANDARDINSTALLNINGAR,
  type Historikpost,
  type Installningar,
  type Utseende,
} from './lagring';

export interface AppTillstand {
  /** Falskt tills lagringen är läst. Vyerna visar inget halvfärdigt så länge. */
  readonly laddat: boolean;
  readonly installningar: Installningar;
  readonly historik: readonly Historikpost[];
  satt<K extends keyof Installningar>(nyckel: K, varde: Installningar[K]): void;
  valjUtseende(utseende: Utseende): void;
  laggTill(post: Historikpost): void;
  taBort(id: string): void;
  rensa(): void;
}

const Kontext = createContext<AppTillstand | null>(null);

export function AppProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [laddat, setLaddat] = useState(false);
  const [installningar, setInstallningar] = useState<Installningar>(STANDARDINSTALLNINGAR);
  const [historik, setHistorik] = useState<readonly Historikpost[]>([]);

  useEffect(() => {
    let kvar = true;
    void (async () => {
      const [i, h] = await Promise.all([lasInstallningar(), lasHistorik()]);
      if (!kvar) return;
      setInstallningar(i);
      setHistorik(h);
      setLaddat(true);
    })();
    return () => {
      kvar = false;
    };
  }, []);

  const spara = useCallback((nya: Installningar) => {
    setInstallningar(nya);
    void skrivInstallningar(nya);
  }, []);

  const sparaHistorik = useCallback((nya: readonly Historikpost[]) => {
    setHistorik(nya);
    void skrivHistorik(nya);
  }, []);

  const varde = useMemo<AppTillstand>(
    () => ({
      laddat,
      installningar,
      historik,
      satt: (nyckel, v) => spara({ ...installningar, [nyckel]: v }),
      valjUtseende: (utseende) => spara({ ...installningar, utseende }),
      laggTill: (post) => sparaHistorik([post, ...historik]),
      taBort: (id) => sparaHistorik(historik.filter((p) => p.id !== id)),
      rensa: () => sparaHistorik([]),
    }),
    [laddat, installningar, historik, spara, sparaHistorik],
  );

  return <Kontext.Provider value={varde}>{children}</Kontext.Provider>;
}

export function useApp(): AppTillstand {
  const v = useContext(Kontext);
  if (!v) throw new Error('useApp måste användas inuti AppProvider.');
  return v;
}
