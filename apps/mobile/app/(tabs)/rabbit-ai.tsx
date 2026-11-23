/**
 * Rabbit AI-fliken: vy 21, 21b, 21c-1, 21c-2, 21d, 21e och 21f.
 *
 * Fliken äger samtalet: tråden, strömningen, dagsgränsen och de sparade
 * samtalen. Skalet ritas av komponenter/RabbitAI.tsx.
 *
 * En räknefråga räknas aldrig här. Servern svarar kort och skickar en
 * `rakna`-händelse, som blir kortet "Räkna på det" (21d). Ett tryck byter till
 * Räkna-fliken med frågan som parameter, och Räkna räknar den.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { medFelgrans } from '../../komponenter/Felgrans';
import { Bakgrund } from '../../komponenter/Bakgrund';
import { RabbitAI } from '../../komponenter/RabbitAI';
import { SKARMMARGINAL } from '../../design/tokens';
import {
  enhetsId,
  lasSamtalen,
  skrivSamtalen,
  stromma,
  type Meddelande,
  type Samtal,
  type Stromning,
} from '../../lib/chatt';
import { useHaptik } from '../../lib/rorelse';

function RabbitAiSkarm(): ReactNode {
  const router = useRouter();
  const haptik = useHaptik();
  const insets = useSafeAreaInsets();

  const [meddelanden, setMeddelanden] = useState<readonly Meddelande[]>([]);
  const [strommar, setStrommar] = useState<string | null>(null);
  /** Sant medan modellen slår upp något på webben (21c-1). */
  const [soker, setSoker] = useState(false);
  const [slutOm, setSlutOm] = useState<number | null>(null);
  const [utkast, setUtkast] = useState('');
  const [samtal, setSamtal] = useState<readonly Samtal[]>([]);

  const stromningen = useRef<Stromning | null>(null);
  const mittId = useRef<string | null>(null);
  /** Samtalets id. Nytt samtal ger ett nytt, så historiken inte skrivs över. */
  const samtalsId = useRef<string>(`s${Date.now()}`);
  const [aktivtId, setAktivtId] = useState(samtalsId.current);

  useEffect(() => {
    void (async () => {
      mittId.current = await enhetsId();
    })();
    // Avbryt en pågående strömning när skärmen lämnas för gott.
    return () => stromningen.current?.stoppa();
  }, []);

  // Samtalen läses om varje gång fliken visas, så panelen aldrig är inaktuell.
  const hamtaSamtal = useCallback(() => {
    void (async () => setSamtal(await lasSamtalen()))();
  }, []);
  useFocusEffect(hamtaSamtal);

  /**
   * Sparar samtalet lokalt.
   *
   * Hela tråden skrivs om varje gång i stället för att läggas till: tråden är
   * kort, och att ha EN väg in i lagringen är värt mer än en sparad skrivning.
   */
  async function sparaSamtal(trad: readonly Meddelande[]): Promise<void> {
    if (trad.length === 0) return;
    const nu = new Date().toISOString();
    const alla = await lasSamtalen();
    const utan = alla.filter((x) => x.id !== samtalsId.current);
    const nytt: Samtal = { id: samtalsId.current, meddelanden: trad, datum: nu };
    const hela = [nytt, ...utan];
    await skrivSamtalen(hela);
    setSamtal(hela);
  }

  /** Skickar frågan och strömmar svaret (21b, 21c-1, 21c-2). */
  function skicka(text?: string): void {
    const fragan = (text ?? utkast).trim();
    if (fragan === '' || strommar !== null || slutOm !== null) return;
    const id = mittId.current;
    if (id === null) return;

    const trad: readonly Meddelande[] = [...meddelanden, { roll: 'jag', text: fragan }];
    setMeddelanden(trad);
    setUtkast('');
    // Tom sträng betyder "tänker" (21c-1). Första biten text ger 21c-2.
    setStrommar('');
    setSoker(false);

    let samlat = '';
    stromningen.current = stromma(
      id,
      trad.map((m) => ({ roll: m.roll, text: m.text })),
      {
        text: (bit) => {
          samlat += bit;
          setStrommar(samlat);
        },
        soker: () => setSoker(true),
        klart: (slut) => {
          stromningen.current = null;
          setStrommar(null);
          setSoker(false);
          if (slut.sort === 'slut') {
            setSlutOm(slut.nollstallsOm);
            void sparaSamtal(trad);
            return;
          }
          if (slut.sort === 'fel') {
            haptik('varning');
            const svar: Meddelande = {
              roll: 'du',
              text:
                slut.typ === 'ingen-anslutning'
                  ? 'Ingen anslutning. Frågan är kvar — försök igen.'
                  : 'Något gick fel hos oss. Försök igen om en stund.',
            };
            const hela = [...trad, svar];
            setMeddelanden(hela);
            void sparaSamtal(hela);
            return;
          }
          const svar: Meddelande = {
            roll: 'du',
            text: samlat,
            ...(slut.sort === 'klart' && slut.raknaPa !== undefined
              ? { raknaPa: slut.raknaPa }
              : {}),
            ...(slut.sort === 'stoppat' ? { stoppat: true } : {}),
            // Källorna sparas med samtalet, så en gammal tråd bär dem kvar.
            ...(slut.sort === 'klart' && slut.kallor !== undefined && slut.kallor.length > 0
              ? { kallor: slut.kallor }
              : {}),
          };
          const hela = [...trad, svar];
          setMeddelanden(hela);
          void sparaSamtal(hela);
        },
      },
    );
  }

  function nyttSamtal(): void {
    stromningen.current?.stoppa();
    samtalsId.current = `s${Date.now()}`;
    setAktivtId(samtalsId.current);
    setMeddelanden([]);
    setStrommar(null);
    setSoker(false);
    setSlutOm(null);
    setUtkast('');
  }

  return (
    <Bakgrund>
      <View style={[styles.innehall, { paddingTop: insets.top }]}>
        <RabbitAI
          meddelanden={meddelanden}
          strommar={strommar}
          soker={soker}
          slutOm={slutOm}
          utkast={utkast}
          onUtkast={setUtkast}
          onSkicka={skicka}
          onStoppa={() => stromningen.current?.stoppa()}
          onNyttSamtal={nyttSamtal}
          onRaknaPa={(fraga) => {
            // Räkna äger räkningen. Frågan följer med som parameter, och
            // nonsen gör att samma fråga går att skicka igen.
            stromningen.current?.stoppa();
            router.navigate({
              pathname: '/',
              params: { raknaPa: fraga, n: String(Date.now()) },
            });
          }}
          onBytTillRakna={() => router.navigate('/')}
          samtal={samtal}
          aktivtSamtal={aktivtId}
          onOppnaSamtal={(s) => {
            stromningen.current?.stoppa();
            samtalsId.current = s.id;
            setAktivtId(s.id);
            setMeddelanden(s.meddelanden);
            setStrommar(null);
            setSlutOm(null);
            setUtkast('');
          }}
          onTaBortSamtal={(id) => {
            // 21f: svep på en rad tar bort just det samtalet.
            const kvar = samtal.filter((x) => x.id !== id);
            setSamtal(kvar);
            void skrivSamtalen(kvar);
            // Togs samtalet som visas bort ska tråden inte stå kvar.
            if (id === samtalsId.current) nyttSamtal();
          }}
          onRensaSamtal={() => {
            void skrivSamtalen([]);
            setSamtal([]);
            nyttSamtal();
          }}
        />
      </View>
    </Bakgrund>
  );
}

const styles = StyleSheet.create({
  innehall: { flex: 1, paddingHorizontal: SKARMMARGINAL },
});

/**
 * Fliken ligger i en felgräns: ett fel i render visar ett kort med felets
 * text i stället för att stänga appen (direktiv 17).
 */
export default medFelgrans(RabbitAiSkarm, 'Rabbit AI');
