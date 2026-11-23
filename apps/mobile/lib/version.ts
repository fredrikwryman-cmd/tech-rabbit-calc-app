/**
 * Vilken version som faktiskt körs.
 *
 * Direktiv 18: en uppdatering som inte "tar" ser ut precis som en app som
 * aldrig uppdaterats. Långtryck på logotypen visar därför uppdaterings-id,
 * runtimeVersion och kanal, så att det går att se vilken kod som körs i
 * stället för att gissa.
 *
 * `expo-updates` laddas lazy med `require` i try/catch, samma mönster som
 * lib/rost.ts och lib/dela.ts: modulen finns inte i Expo Go, och den här
 * rutan får aldrig vara skälet till att appen inte startar.
 */

/** Metro ger varje modul ett `require`. Det finns inte i TypeScripts typer. */
declare const require: (modul: string) => unknown;

/** Det lilla vi läser ur expo-updates. Fler fält finns, men inte behövs. */
interface Uppdateringar {
  readonly updateId: string | null;
  readonly runtimeVersion: string | null;
  readonly channel: string | null;
  readonly isEmbeddedLaunch: boolean;
  readonly createdAt: Date | null;
}

let modulen: Uppdateringar | null | undefined;

function uppdateringsmodul(): Uppdateringar | null {
  if (modulen !== undefined) return modulen;
  try {
    modulen = require('expo-updates') as Uppdateringar;
  } catch {
    modulen = null;
  }
  return modulen;
}

export interface Version {
  /** Uppdateringens id, eller "inbyggd" när bygget kör sin egen kod. */
  readonly uppdatering: string;
  readonly runtime: string;
  readonly kanal: string;
  /** När uppdateringen publicerades, tom sträng för en inbyggd start. */
  readonly skapad: string;
}

/**
 * Läser versionen. Kastar aldrig: saknas modulen svarar den "inbyggd".
 *
 * `isEmbeddedLaunch` är sant när bygget kör sitt eget inbyggda paket. Är den
 * falsk OCH id saknas körs koden från en utvecklingsserver.
 */
export function lasVersion(): Version {
  const u = uppdateringsmodul();
  if (u === null) {
    return { uppdatering: 'inbyggd (ingen expo-updates)', runtime: '—', kanal: '—', skapad: '' };
  }
  const id = u.updateId;
  const uppdatering =
    id !== null && id !== undefined
      ? id
      : u.isEmbeddedLaunch
        ? 'inbyggd'
        : 'utvecklingsserver';
  return {
    uppdatering,
    runtime: u.runtimeVersion ?? '—',
    kanal: u.channel === null || u.channel === undefined || u.channel === '' ? '—' : u.channel,
    skapad: u.createdAt instanceof Date ? u.createdAt.toISOString().slice(0, 16).replace('T', ' ') : '',
  };
}
