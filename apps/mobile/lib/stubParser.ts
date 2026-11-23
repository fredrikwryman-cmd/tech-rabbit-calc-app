/**
 * RESERV FÖR UTVECKLING — aldrig i ett produktionsbygge.
 * =====================================================
 *
 * Det här är INGEN tolkning. Den känner igen de tre exempelfrågorna, skickar
 * dem till räknemotorn och svarar med fel på allt annat.
 *
 * Den riktiga tolkningen ligger i apps/api och nås via lib/api-tolkare.ts.
 * Den här filen används bara när EXPO_PUBLIC_API_URL inte är satt OCH bygget
 * är ett utvecklingsbygge — se lib/aktiv-tolkare.ts, som gör det valet. Ett
 * produktionsbygge utan adress visar vy 06a i stället.
 *
 * Den finns kvar för att vyerna ska gå att prova utan server. Förklaringarna
 * nedan är skrivna för hand för just de här tre frågorna. Riktiga förklaringar
 * skrivs av modellen. Inget av det här är produktinnehåll.
 */

import { arBehov, breakEven, interest, margin } from '@techrabbit/engine';

import type { Fragekontext, Tolkare, Tolkningssvar } from './tolkning';

/** Hur länge stubben låtsas tänka, så vy 03 "Räknar" hinner synas. */
export const STUB_FORDROJNING_MS = 1600;

function normalisera(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ \s]+/g, ' ')
    .trim();
}

function innehaller(text: string, ...delar: readonly string[]): boolean {
  return delar.every((d) => text.includes(d));
}

function dröj(ms: number): Promise<void> {
  return new Promise((klar) => setTimeout(klar, ms));
}

/** Tolkar ett svenskt tal: "300", "2,5". */
function lasTal(text: string): number | null {
  const rensat = text.replace(/[ \s]/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(rensat)) return null;
  return Number(rensat);
}

function tolkaSynkront(fraga: string, kontext: Fragekontext): Tolkningssvar {
  const t = normalisera(fraga);

  // Exempelfråga 1: plus minus noll.
  if (innehaller(t, 'plus minus noll') || innehaller(t, '12 kr', 'sälja resten')) {
    // Utan ordet "använder" saknas värdet på det som går åt → vy 04.
    const egetBruk = kontext.foljdsvar && kontext.foljdsvar.length > 0
      ? lasTal(kontext.foljdsvar[kontext.foljdsvar.length - 1]?.varde ?? '')
      : t.includes('använder')
        ? 300
        : null;

    if (egetBruk === null) {
      return {
        sort: 'foljdfraga',
        fraga: 'Hur mycket använder du själv?',
        enhet: 'gram',
      };
    }

    const svar = breakEven(12, { value: 1, unit: 'kg' }, { value: egetBruk, unit: 'g' }, 'kg');
    if (arBehov(svar)) return { sort: 'fel', fel: 'kunde-inte-tolka' };
    const kvar = 1000 - egetBruk;
    return {
      sort: 'svar',
      etikett: 'Lägsta pris för resten',
      resultat: svar,
      forklaring:
        `Du har ${kvar} gram kvar att sälja. Säljer du dem för ${svar.formatted} kr per ` +
        'kilo får du tillbaka de 12 kronorna du betalade.',
    };
  }

  // Exempelfråga 2: vinstmarginal.
  if (innehaller(t, 'köp 40') && innehaller(t, '65')) {
    const svar = margin(40, 65);
    return {
      sort: 'svar',
      etikett: 'Marginal',
      resultat: svar,
      forklaring:
        'Du tjänar 25 kr på varje vara. Det är 38,5 % av de 65 kronorna kunden betalar.',
    };
  }

  // Exempelfråga 3: ränta.
  if (innehaller(t, '3,5') && innehaller(t, '200 000')) {
    const svar = interest(200_000, 3.5, 1);
    return {
      sort: 'svar',
      etikett: 'Ränta på ett år',
      resultat: svar,
      forklaring: '3,5 % av 200 000 kr är 7 000 kr. Det är räntan för ett år.',
    };
  }

  return { sort: 'fel', fel: 'kunde-inte-tolka' };
}

/** Stubben, som Tolkare. Byts mot API-anropet i direktiv 3. */
export const stubParser: Tolkare = {
  async tolka(fraga, kontext): Promise<Tolkningssvar> {
    if (!kontext.harNat) {
      await dröj(300);
      return { sort: 'fel', fel: 'ingen-anslutning' };
    }
    await dröj(STUB_FORDROJNING_MS);
    return tolkaSynkront(fraga, kontext);
  },
};
