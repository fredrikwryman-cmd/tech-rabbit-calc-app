/**
 * Rörelse och haptik enligt design/RORELSE-HAPTIK.md och skillen rev-ux
 * (docs/design/skills/rev-ux.md, avsnitt 3 och 7).
 *
 * Direktiv 39: tiderna och fjädrarna heter numera samma som i rev-ux och
 * ligger i `rm`. De gamla namnen (TRYCK_MS, YTA_MS, SKARM_MS) finns kvar och
 * pekar på samma värden, så ingen vy behöver skrivas om för att byta takt.
 *
 * Fredriks beslut i direktiv 39: fjädrarna får en LITEN överstudsning i
 * stället för `overshootClamping`. Det är överstudsningen som gör att en yta
 * känns buren av något i stället för att bara stanna.
 *
 * Med "Reducera rörelse" på blir ALL rörelse en toning på 160 ms. Ingen
 * fjädring och ingen förflyttning. Haptiken ligger kvar — den är inte
 * rörelse, och den som stänger av animationer vill inte tappa bekräftelsen.
 * Det är därför varje komponent frågar useRorelse() i stället för att skriva
 * in en tid själv.
 */

import * as Haptics from 'expo-haptics';
import { Easing, useReducedMotion, type WithTimingConfig } from 'react-native-reanimated';

import { useApp } from './app-state';

/**
 * Rörelsetokens, rev-ux avsnitt 3.
 *
 * Tider i ms. Allt som följer fingret är fysik (fjäder/decay), aldrig tid.
 * Studs bara vid firande — `bouncy` används inte i den här appen än.
 */
export const rm = {
  /** Tryck-ned. Feedback ska synas inom 100 ms (A12). */
  tap: 90,
  /** Ikonbyte, chip, text som byts. */
  swap: 160,
  /** Sidbyte och hero. */
  push: 320,
  /** Ark upp och ned. */
  sheet: 380,
  /** Ett kort som flyger in i listan. */
  send: 420,
  /** Hemskärmens entré. */
  entrance: 550,
  /** Firande. */
  celebrate: 2500,
  /** Avståndet i tid mellan raderna när innehåll kommer in. */
  stagger: 35,
  /** Knappar, chips, ikoner. */
  snappy: { damping: 24, stiffness: 340, mass: 1 },
  /** Sidor, ark, scroll-snäpp. */
  smooth: { damping: 28, stiffness: 220, mass: 1 },
  /** Hero: liten överstudsning. */
  hero: { damping: 18, stiffness: 210, mass: 1 },
  /** Chattbubblor. */
  bubble: { damping: 20, stiffness: 260, mass: 0.9 },
  /** Bara firande. */
  bouncy: { damping: 14, stiffness: 200, mass: 1 },
  /** Skalan på sidan bakom ett ark. */
  recedeScale: 0.94,
  /** Mörkläggningen bakom ett ark. */
  recedeDim: 0.45,
  /** Tryckets skala. */
  pressScale: 0.97,
} as const;

export const TRYCK_MS = rm.tap;
export const YTA_MS = rm.swap;
export const SKARM_MS = rm.push;
/** Arkets väg upp och ned. */
export const ARK_MS = rm.sheet;
/** Toningen som ersätter all rörelse när "Reducera rörelse" är på. */
export const REDUCERAD_MS = 160;

/** Tryckets skala, rev-ux A12. */
export const TRYCKSKALA = rm.pressScale;

export const KURVA = Easing.bezier(0.2, 0, 0, 1);

/**
 * Appens allmänna fjäder: `smooth` ur rev-ux, utan clamping.
 *
 * Direktiv 39: överstudsningen är liten och avsiktlig. `overshootClamping`
 * är borta.
 */
export const FJADER = {
  damping: rm.smooth.damping,
  stiffness: rm.smooth.stiffness,
  mass: rm.smooth.mass,
} as const;

export interface Rorelse {
  /** Sant när systemets "Reducera rörelse" är på. */
  readonly reducerad: boolean;
  /** Toning: tiden du bad om, eller 160 ms när rörelse är reducerad. */
  toning(ms?: number): WithTimingConfig;
  /** Hur långt något får glida. Noll när rörelse är reducerad. */
  glid(pt: number): number;
  /** Skalan vid tryck. 1 när rörelse är reducerad. */
  readonly tryckskala: number;
  /**
   * Fördröjningen för rad nr `i` när innehåll kommer in i ordning.
   * Noll när rörelse är reducerad: då kommer allt samtidigt.
   */
  ordning(i: number): number;
}

export function useRorelse(): Rorelse {
  const reducerad = useReducedMotion();
  return {
    reducerad,
    toning: (ms = YTA_MS) => ({
      duration: reducerad ? REDUCERAD_MS : ms,
      easing: KURVA,
    }),
    glid: (pt) => (reducerad ? 0 : pt),
    tryckskala: reducerad ? 1 : TRYCKSKALA,
    ordning: (i) => (reducerad ? 0 : i * rm.stagger),
  };
}

/**
 * Haptikens sorter, rev-ux avsnitt 7.
 *
 * De tre gamla namnen ligger först: inget anrop i appen behövde ändras.
 */
export type Haptiksort =
  | 'latt'
  | 'bekraftelse'
  | 'varning'
  | 'val'
  | 'mjuk'
  | 'medel'
  | 'fast'
  | 'fel';

/** Spärren ur rev-ux 8.1: aldrig två vibrationer inom 80 ms. */
export const HAPTIKSPARR_MS = 80;

let haptikPa = true;
let senaste = 0;

/**
 * Av-knappen. Sätts av AppProvider när inställningen läses eller ändras, så
 * att haptic() fungerar också utanför en komponent.
 */
export function sattHaptik(pa: boolean): void {
  haptikPa = pa;
}

/**
 * Den centrala haptiken (rev-ux 8.1).
 *
 * En enda väg ut till `expo-haptics`: spärren och av-knappen gäller då varje
 * anrop i appen, inte bara de som råkar gå via useHaptik().
 */
export function haptic(sort: Haptiksort): void {
  if (!haptikPa) return;
  const nu = Date.now();
  if (nu - senaste < HAPTIKSPARR_MS) return;
  senaste = nu;
  const I = Haptics.ImpactFeedbackStyle;
  const N = Haptics.NotificationFeedbackType;
  switch (sort) {
    case 'val':
      void Haptics.selectionAsync();
      return;
    case 'bekraftelse':
      void Haptics.notificationAsync(N.Success);
      return;
    case 'varning':
      void Haptics.notificationAsync(N.Warning);
      return;
    case 'fel':
      void Haptics.notificationAsync(N.Error);
      return;
    case 'medel':
      void Haptics.impactAsync(I.Medium);
      return;
    case 'fast':
      void Haptics.impactAsync(I.Rigid);
      return;
    case 'mjuk':
      void Haptics.impactAsync(I.Soft);
      return;
    default:
      void Haptics.impactAsync(I.Light);
  }
}

/**
 * Haptiken styrd av inställningen Knappvibration.
 *
 * Kroken finns kvar för att vyerna redan använder den. Själva beslutet om
 * på eller av bor i `haptic()`, så båda vägarna lyder samma spärr.
 */
export function useHaptik(): (sort: Haptiksort) => void {
  const { installningar } = useApp();
  const pa = installningar.knappvibration;
  return (sort) => {
    if (!pa) return;
    haptic(sort);
  };
}

/** Bekräftelsen när Knappvibration just slogs på. Lyder inte inställningen. */
export function haptikPaslagen(): void {
  senaste = Date.now();
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
