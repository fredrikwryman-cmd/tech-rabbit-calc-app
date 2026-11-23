/**
 * Vilken tolkare appen använder — ett enda ställe att läsa och ändra på.
 *
 * Är EXPO_PUBLIC_API_URL satt går frågan till tolkningstjänsten. Är den inte
 * satt finns två fall, och de ska inte behandlas likadant:
 *
 *   utvecklingsbygge  stubParser, så vyerna går att prova utan server.
 *   produktionsbygge  API-tolkaren ändå, som svarar 'ingen-anslutning'.
 *
 * Det andra fallet är med flit. Ett produktionsbygge som glömt adressen ska
 * visa vy 06a, aldrig låtsas räkna med tre inövade exempelfrågor.
 */

import { API_URL, apiTolkare, STEG2_EFTER_MS, STEG3_EFTER_MS } from './api-tolkare';
import { STUB_FORDROJNING_MS, stubParser } from './stubParser';
import type { Tolkare } from './tolkning';

const anvandStub = API_URL === null && __DEV__;

/** Tolkaren vyerna anropar. */
export const tolkare: Tolkare = anvandStub ? stubParser : apiTolkare;

/** När vy 03 byter från steg 1 till steg 2. */
export const stegbyteMs: number = anvandStub
  ? Math.round(STUB_FORDROJNING_MS / 3)
  : STEG2_EFTER_MS;

/**
 * När vy 03 byter från steg 2 till steg 3 ("Förbereder förklaring").
 * Steg 3 står kvar tills svaret kommer — det är där förklaringen skrivs.
 */
export const steg3Ms: number = anvandStub
  ? Math.round((STUB_FORDROJNING_MS * 2) / 3)
  : STEG3_EFTER_MS;

/** Vad som faktiskt svarar. Används i Inställningar och vid felsökning. */
export const kalla: 'api' | 'stub' = anvandStub ? 'stub' : 'api';

if (anvandStub) {
  console.warn(
    'EXPO_PUBLIC_API_URL är inte satt. Använder stubParser, som bara känner ' +
      'de tre exempelfrågorna. Sätt adressen för att tolka på riktigt.',
  );
}
