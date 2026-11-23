/**
 * Appens rot: typsnitt, tema och navigation.
 */

import {
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_900Black,
  useFonts,
} from '@expo-google-fonts/archivo';
import { Stack } from 'expo-router';
import { setStatusBarStyle, StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Startskarm } from '../komponenter/Startskarm';
import { mala } from '../lib/rotbakgrund';
import { TemaProvider, useTema } from '../design/tema';
import { AppProvider } from '../lib/app-state';

void SplashScreen.preventAutoHideAsync();

function Navigation(): ReactNode {
  const { lage, farg } = useTema();
  const statusstil = lage === 'dark' ? 'light' : 'dark';

  /**
   * Statusfältet och appens botten följer temat, inte systemet.
   *
   * Direktiv 17: i det fristående bygget ritades klockan mörkt mot mörk
   * bakgrund. `<StatusBar>` sätter stilen när den monteras, men en skärm som
   * monteras senare kan skriva över den, och efter ett temabyte stod den
   * kvar. Ett imperativt anrop vid varje temabyte är det som faktiskt håller.
   *
   * `setBackgroundColorAsync` målar rotvyn under React. Den färgen sätts i
   * ett riktigt bygge av startbildens bakgrund och ändras aldrig av sig
   * själv, så allt som inte täcks av appens egna ytor — och ytorna under
   * tangentbordet och modalerna — blir fel när temat inte är det som
   * startbilden valde.
   */
  useEffect(() => {
    setStatusBarStyle(statusstil, false);
    mala(farg['bg'] ?? null);
  }, [statusstil, farg]);

  return (
    <>
      <StatusBar style={statusstil} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: farg['bg'] },
        }}
      />
    </>
  );
}

export default function RotLayout(): ReactNode {
  const [typsnittKlara, typsnittsfel] = useFonts({
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    Archivo_900Black,
  });

  useEffect(() => {
    if (typsnittKlara || typsnittsfel) void SplashScreen.hideAsync();
  }, [typsnittKlara, typsnittsfel]);

  // Visa ingenting hellre än fel typsnitt. Startbilden ligger kvar så länge.
  if (!typsnittKlara && !typsnittsfel) return null;

  return (
    // GestureHandlerRootView behövs för svepet i historiken.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <TemaProvider>
            {/* Vy 22: startskärmen ligger överst tills appen är igång. */}
            <Startskarm>
              <Navigation />
            </Startskarm>
          </TemaProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
