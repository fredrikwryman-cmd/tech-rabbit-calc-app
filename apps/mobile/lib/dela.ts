/**
 * Dela: delningskortet i design v2 (vy 10).
 *
 * Svaret delas som en BILD genom telefonens egen delningsmeny. Bilden ritas
 * av appen, fångas av `react-native-view-shot` till en tillfällig fil och
 * lämnas till `expo-sharing`. Ingenting skickas till vår server: filen ligger
 * i telefonens cache, och vart användaren sedan skickar den är telefonens sak.
 *
 * ## Varför modulerna laddas lazy
 *
 * Samma skäl som i lib/rost.ts: båda är native-moduler, och en vanlig import
 * körs när filen läses in. Saknas modulen — Expo Go, webben, ett äldre bygge —
 * ska knappen säga det i stället för att fälla appen. Typerna importeras med
 * `import type`, som försvinner vid bygget.
 */

import type { ViewInstance } from 'react-native';
import type * as ExpoSharing from 'expo-sharing';
import type { captureRef } from 'react-native-view-shot';

/** Metro ger varje modul ett `require`. Det finns inte i TypeScripts typer. */
declare const require: (modul: string) => unknown;

type Fangare = typeof captureRef;
type Delare = typeof ExpoSharing;

let fangaren: Fangare | null | undefined;
let delaren: Delare | null | undefined;

function laddaFangare(): Fangare | null {
  if (fangaren !== undefined) return fangaren;
  try {
    const paket = require('react-native-view-shot') as { captureRef?: Fangare };
    fangaren = paket.captureRef ?? null;
  } catch {
    fangaren = null;
  }
  return fangaren;
}

function laddaDelare(): Delare | null {
  if (delaren !== undefined) return delaren;
  try {
    delaren = require('expo-sharing') as Delare;
  } catch {
    delaren = null;
  }
  return delaren;
}

/** Sant när bygget kan dela en bild, dvs. inte i Expo Go. */
export function delningFinns(): boolean {
  return laddaFangare() !== null && laddaDelare() !== null;
}

export type Delningssvar =
  /** Delningsmenyn öppnades. Om användaren skickade något vet vi inte. */
  | 'klart'
  /** Användaren stängde menyn utan att dela. */
  | 'avbrutet'
  /** Modulerna finns inte i det här bygget (Expo Go). */
  | 'saknas'
  | 'fel';

/**
 * Fångar vyn som PNG och öppnar delningsmenyn.
 *
 * Bilden skrivs till en tillfällig fil: `result: 'tmpfile'`. Delningsmenyn
 * behöver en fil-URL, och en base64-sträng i minnet skulle ändå behöva
 * skrivas till disk först. Filen ligger i appens cache och städas av iOS.
 */
export async function delaVy(ref: ViewInstance | null): Promise<Delningssvar> {
  const fanga = laddaFangare();
  const dela = laddaDelare();
  if (fanga === null || dela === null) return 'saknas';
  if (ref === null) return 'fel';
  try {
    if (!(await dela.isAvailableAsync())) return 'saknas';
    const fil = await fanga(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      fileName: 'tech-rabbit-calc',
    });
    await dela.shareAsync(fil, {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle: 'Dela uträkningen',
    });
    return 'klart';
  } catch {
    // shareAsync kastar också när användaren stänger menyn på iOS. Det är
    // inget fel, så skillnaden mellan avbrutet och fel är inte värd en lögn:
    // vyn säger ingenting alls i båda fallen.
    return 'avbrutet';
  }
}
