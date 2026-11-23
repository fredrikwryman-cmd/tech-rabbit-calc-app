/**
 * Rörelse och haptik enligt design/RORELSE-HAPTIK.md.
 *
 * Grundvärden: tryck 100 ms, yta 200 ms, skärmbyte 280 ms,
 * fjäder 26/260/0.9 utan överskjutning, kurva cubic-bezier(0.2, 0, 0, 1).
 *
 * Med "Reducera rörelse" på blir ALL rörelse en toning på 120 ms. Ingen
 * fjädring och ingen förflyttning. Det är därför varje komponent frågar
 * useRorelse() i stället för att skriva in en tid själv.
 */

import * as Haptics from 'expo-haptics';
import { Easing, useReducedMotion, type WithTimingConfig } from 'react-native-reanimated';

import { useApp } from './app-state';

export const TRYCK_MS = 100;
export const YTA_MS = 200;
export const SKARM_MS = 280;
export const REDUCERAD_MS = 120;

/** Tryckets skala, enligt KOMPONENTER.md: 0.97 på 100 ms. */
export const TRYCKSKALA = 0.97;

export const KURVA = Easing.bezier(0.2, 0, 0, 1);

export const FJADER = {
  damping: 26,
  stiffness: 260,
  mass: 0.9,
  overshootClamping: true,
} as const;

export interface Rorelse {
  /** Sant när systemets "Reducera rörelse" är på. */
  readonly reducerad: boolean;
  /** Toning: tiden du bad om, eller 120 ms när rörelse är reducerad. */
  toning(ms?: number): WithTimingConfig;
  /** Hur långt något får glida. Noll när rörelse är reducerad. */
  glid(pt: number): number;
  /** Skalan vid tryck. 1 när rörelse är reducerad. */
  readonly tryckskala: number;
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
  };
}

export type Haptiksort = 'latt' | 'bekraftelse' | 'varning';

/**
 * Haptiken styrs av inställningen Knappvibration. Är den av händer ingenting.
 */
export function useHaptik(): (sort: Haptiksort) => void {
  const { installningar } = useApp();
  const pa = installningar.knappvibration;
  return (sort) => {
    if (!pa) return;
    if (sort === 'latt') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (sort === 'bekraftelse')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };
}

/** Bekräftelsen när Knappvibration just slogs på. Lyder inte inställningen. */
export function haptikPaslagen(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
