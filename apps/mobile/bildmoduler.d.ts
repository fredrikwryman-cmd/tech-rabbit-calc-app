/**
 * Bildfiler importerade som moduler.
 *
 * Metro gör en `import` av en png till ett asset-id (ett tal), som
 * `Image source` tar emot. Expo levererar ingen deklaration för det, så den
 * står här. Filen är handskriven, till skillnad från expo-env.d.ts.
 */

declare module '*.png' {
  const kalla: number;
  export default kalla;
}
