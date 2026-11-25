/**
 * Fredriks två bilder: TechRabbit AI-loggan och AI-kaninen (direktiv 37).
 *
 * Bilderna ligger i assets som @1x/@2x/@3x. Metro väljer upplösning efter
 * skärmen, så komponenterna anger bara måttet i punkter och låter
 * förhållandet räkna fram det andra måttet. Måtten nedan är källfilernas,
 * mätta efter att den genomskinliga ramen klippts bort.
 */

import type { ReactNode } from 'react';
import { Image } from 'react-native';

import { useTema } from '../design/tema';

import loggaLjus from '../assets/techrabbit-ai-logga-ljus.png';
import loggaMork from '../assets/techrabbit-ai-logga-mork.png';
import kaninStor from '../assets/ai-kanin-stor.png';
import kaninLiten from '../assets/ai-kanin-liten.png';

/** Loggan: 1514 × 710 i källan. */
const LOGGA = 1514 / 710;
/** Kaninen med glöd: 1828 × 1818. */
const KANIN_STOR = 1828 / 1818;
/** Kaninen utan glöd, beskuren tätt runt huvudet: 997 × 1482. */
const KANIN_LITEN = 997 / 1482;

/**
 * TechRabbit AI-loggan. Mörka temat får varianten där texten och kaninen är
 * vita; det gröna är detsamma i båda.
 */
export function LoggaTechRabbitAI({
  bredd,
  hojd,
}: {
  readonly bredd?: number;
  readonly hojd?: number;
}): ReactNode {
  const { lage } = useTema();
  const b = bredd ?? (hojd ?? 0) * LOGGA;
  const h = hojd ?? (bredd ?? 0) / LOGGA;
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={lage === 'dark' ? loggaMork : loggaLjus}
      style={{ width: b, height: h }}
      resizeMode="contain"
    />
  );
}

/** AI-kaninen i stort format, med den gröna glöden. */
export function AiKaninStor({ bredd = 110 }: { readonly bredd?: number }): ReactNode {
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={kaninStor}
      style={{ width: bredd, height: bredd / KANIN_STOR }}
      resizeMode="contain"
    />
  );
}

/**
 * AI-kaninen i litet format. Glöden är borttagen: i 40 pt blir den bara en
 * suddig grön fläck runt huvudet.
 */
export function AiKaninLiten({ hojd = 40 }: { readonly hojd?: number }): ReactNode {
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={kaninLiten}
      style={{ width: hojd * KANIN_LITEN, height: hojd }}
      resizeMode="contain"
    />
  );
}

/** Den lilla kaninens bredd vid en given höjd. Används för indrag i chatten. */
export function kaninLitenBredd(hojd: number): number {
  return Math.round(hojd * KANIN_LITEN);
}
