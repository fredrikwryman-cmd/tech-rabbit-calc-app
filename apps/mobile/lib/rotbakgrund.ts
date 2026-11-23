/**
 * Rotvyns bakgrundsfärg.
 *
 * Färgen under React sätts i ett riktigt bygge en gång, av startbildens
 * bakgrund, och ändras aldrig av sig själv. Allt som inte täcks av appens
 * egna ytor blir därför fel när temat inte är det startbilden valde.
 *
 * ## Varför modulen laddas lazy
 *
 * `expo-system-ui` finns i preview-bygget e4ca2187 — kontrollerat med
 * `expo-modules-autolinking resolve -p ios`. Men en uppdatering som rör en
 * native-modul är ändå det farligaste man kan skicka ut: saknas modulen i
 * bygget kastar importen vid START, och då faller expo-updates tillbaka till
 * det inbyggda paketet och appen ser helt orörd ut. Därför laddas den med
 * `require` i try/catch, precis som rösten och delningen: utan modulen
 * händer ingenting alls, och appen startar.
 */

/** Metro ger varje modul ett `require`. Det finns inte i TypeScripts typer. */
declare const require: (modul: string) => unknown;

interface Systemyta {
  setBackgroundColorAsync(farg: string | null): Promise<void>;
}

let modulen: Systemyta | null | undefined;

function systemyta(): Systemyta | null {
  if (modulen !== undefined) return modulen;
  try {
    const paket = require('expo-system-ui') as Partial<Systemyta>;
    modulen = typeof paket.setBackgroundColorAsync === 'function' ? (paket as Systemyta) : null;
  } catch {
    modulen = null;
  }
  return modulen;
}

/** Målar rotvyn. Gör ingenting när modulen inte finns i bygget. */
export function mala(farg: string | null): void {
  const yta = systemyta();
  if (yta === null) return;
  try {
    void yta.setBackgroundColorAsync(farg);
  } catch {
    // Rotvyns färg är en förbättring, aldrig ett skäl att falla.
  }
}
