/**
 * Temat byggs ur design/tokens/tokens.json.
 *
 * tokens.json är facit. Den importeras som den är, så att en ändring i
 * designunderlaget syns i appen utan att någon skriver av ett värde.
 */

import tokensJson from '../../../design/tokens/tokens.json';

export type Lage = 'light' | 'dark';

/** Ett värde som finns i båda lägena. */
interface TvaLagen {
  readonly light: string;
  readonly dark: string;
}

const tokens = tokensJson as unknown as {
  color: Record<string, TvaLagen>;
  typography: {
    family: string;
    scale: Record<
      string,
      { s: number; lh?: number; w?: number | string; ls?: number; transform?: string; numeric?: string }
    >;
  };
  spacing: { scale: number[]; screenMargin: number };
  radius: Record<string, number | string>;
  size: Record<string, number | string | number[]>;
  motion: {
    press: { ms: number; scale: number };
    surface: { ms: number };
    screen: { ms: number };
    spring: { damping: number; stiffness: number; mass: number };
    reducedMotion: string;
  };
  haptics: Record<string, string>;
};

export type Fargnamn = keyof typeof tokens.color;
export type Textnamn = keyof typeof tokens.typography.scale;

/** Färgerna för ett läge, platta värden. */
export type Palett = { readonly [K in string]: string };

function palett(lage: Lage): Palett {
  const ut: Record<string, string> = {};
  for (const [namn, varden] of Object.entries(tokens.color)) {
    ut[namn] = varden[lage];
  }
  return ut;
}

export const PALETT: Readonly<Record<Lage, Palett>> = {
  light: palett('light'),
  dark: palett('dark'),
};

/** Textstilarna ur tokens.json, översatta till React Natives egenskaper. */
export interface Textstil {
  fontFamily: string;
  fontSize: number;
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
  fontVariant?: ['tabular-nums'];
}

/** Archivo har egna filer per vikt, så vikten blir ett familjenamn. */
const FAMILJ_PER_VIKT: Readonly<Record<number, string>> = {
  500: 'Archivo_500Medium',
  600: 'Archivo_600SemiBold',
  700: 'Archivo_700Bold',
  800: 'Archivo_800ExtraBold',
  900: 'Archivo_900Black',
};

function familj(vikt: number | string | undefined): string {
  // "500/800" i tokens.json betyder olika vikt i olika tillstånd. Grundvärdet
  // är det första; komponenten byter själv när den är vald.
  const n = typeof vikt === 'string' ? Number(vikt.split('/')[0]) : vikt;
  return FAMILJ_PER_VIKT[n ?? 500] ?? FAMILJ_PER_VIKT[500]!;
}

function textstil(namn: string): Textstil {
  const t = tokens.typography.scale[namn];
  if (!t) throw new Error(`Textstilen "${namn}" finns inte i tokens.json.`);
  const stil: Textstil = { fontFamily: familj(t.w), fontSize: t.s };
  if (t.lh !== undefined) stil.lineHeight = t.lh;
  if (t.ls !== undefined) stil.letterSpacing = t.ls;
  if (t.transform === 'uppercase') stil.textTransform = 'uppercase';
  if (t.numeric === 'tabular-nums') stil.fontVariant = ['tabular-nums'];
  return stil;
}

export const TEXT: Readonly<Record<string, Textstil>> = Object.fromEntries(
  Object.keys(tokens.typography.scale).map((namn) => [namn, textstil(namn)]),
);

/** Variant av en textstil i en annan vikt, för valda tillstånd. */
export function iVikt(stil: Textstil, vikt: number): Textstil {
  return { ...stil, fontFamily: familj(vikt) };
}

export const ALLA_ARCHIVO_VIKTER = Object.values(FAMILJ_PER_VIKT);

export const SPACING = tokens.spacing;
export const RADIUS = tokens.radius;
export const SIZE = tokens.size;
export const MOTION = tokens.motion;
export const HAPTICS = tokens.haptics;
export const TYPSNITTSFAMILJ = tokens.typography.family;

/** Skärmmarginalen, 20 pt enligt tokens.json. */
export const SKARMMARGINAL = tokens.spacing.screenMargin;
