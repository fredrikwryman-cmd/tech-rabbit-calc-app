/**
 * Lagret bakom ett ark, rev-ux 4.1 punkt 3 och A3.
 *
 * "Sidan bakom sjunker till 0.94 och mörknar, synlig som lager upptill."
 * Arket ligger i en Modal och kan därför inte skala skärmen under sig
 * själv — den ligger i ett annat fönster. Räknaren här är bryggan: ett ark
 * som öppnas räknar upp, och skärmens ram (komponenter/Skarm.tsx) läser
 * räknaren och sjunker.
 *
 * Räknare och inte en boolean: Resultat, Räkna vidare och Dela kan avlösa
 * varandra, och skärmen bakom ska inte studsa upp i mellanrummet.
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

interface Arklager {
  /** Hur många ark som är öppna just nu. */
  readonly oppna: number;
  oppna_: () => void;
  stang: () => void;
}

const Kontext = createContext<Arklager | null>(null);

export function ArkProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [oppna, setOppna] = useState(0);
  const oppna_ = useCallback(() => setOppna((n) => n + 1), []);
  const stang = useCallback(() => setOppna((n) => (n > 0 ? n - 1 : 0)), []);
  const varde = useMemo<Arklager>(() => ({ oppna, oppna_, stang }), [oppna, oppna_, stang]);
  return <Kontext.Provider value={varde}>{children}</Kontext.Provider>;
}

/** Sant när minst ett ark är öppet. Skärmens ram sjunker då. */
export function useArkOppet(): boolean {
  return (useContext(Kontext)?.oppna ?? 0) > 0;
}

/**
 * Anmäler ett ark så länge det är öppet.
 *
 * Avanmälan ligger i effektens städning, så ett ark som tas ur trädet medan
 * det är öppet inte lämnar skärmen bakom nedsänkt för alltid.
 */
export function useAnmalArk(oppet: boolean): void {
  const lager = useContext(Kontext);
  useEffect(() => {
    if (!oppet || lager === null) return;
    lager.oppna_();
    return () => lager.stang();
    // Bara `oppet` ska styra: lager är stabilt ur useMemo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppet]);
}
