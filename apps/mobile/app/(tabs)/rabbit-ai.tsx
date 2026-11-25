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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { medFelgrans } from '../../komponenter/Felgrans';
import { Bakgrund } from '../../komponenter/Bakgrund';
import { DelaSheet } from '../../komponenter/Delning';
import { RabbitAI } from '../../komponenter/RabbitAI';
import { ResultatSheet } from '../../komponenter/ResultatSheet';
import { SKARMMARGINAL } from '../../design/tokens';
import { useApp } from '../../lib/app-state';
import { hittaRaknat, type Overlamning } from '../../lib/chatt-trad';
import { postSomResultat, type Historikpost } from '../../lib/lagring';
import { delningsbildensHuvudsvar, delningsbildensRader } from '../../lib/resultatvy';
import {
  enhetsId,
  lasSamtalen,
  skrivSamtalen,
  stromma,
  type Meddelande,
  type Samtal,
  type Stromning,
} from '../../lib/chatt';
import { haptic, useHaptik } from '../../lib/rorelse';

function RabbitAiSkarm(): ReactNode {
  const router = useRouter();
  /** Direktiv 30: frågan Räkna skickade hit från en felvy (06d och 06e). */
  const parametrar = useLocalSearchParams<{ fragaText?: string; n?: string }>();
  const haptik = useHaptik();
  const insets = useSafeAreaInsets();
  /** Historiken bär uträkningarna som ligger som kort i tråden (rev-ux 5.6). */
  const { historik } = useApp();

  const [meddelanden, setMeddelanden] = useState<readonly Meddelande[]>([]);
  const [strommar, setStrommar] = useState<string | null>(null);
  /** Sant medan modellen slår upp något på webben (21c-1). */
  const [soker, setSoker] = useState(false);
  const [slutOm, setSlutOm] = useState<number | null>(null);
  const [utkast, setUtkast] = useState('');
  const [samtal, setSamtal] = useState<readonly Samtal[]>([]);
  /** Uträkningen som öppnas som ark ur tråden, eller null. */
  const [oppenPost, setOppenPost] = useState<Historikpost | null>(null);
  const [delaOppen, setDelaOppen] = useState(false);

  const stromningen = useRef<Stromning | null>(null);
  /**
   * Frågan chatten lämnade över till Räkna, och när (rev-ux 5.6).
   *
   * Räkna äger räkningen. Chatten minns bara överlämningen och letar efter
   * svaret i historiken när fliken visas igen — ingen ny väg mellan
   * flikarna, och ingen kopia av räknemotorns svar.
   */
  const overlamnat = useRef<Overlamning | null>(null);
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

  /**
   * Frågan Räkna lämnade över läggs i fältet — den skickas inte.
   *
   * Direktiv 30: felvyerna 06d och 06e har knappen "Fråga Rabbit AI". Den
   * ska lämna frågan redo att skicka, inte skicka den: användaren ska se
   * vad som går i väg och kunna ändra den först. `n` är ett löpnummer, så
   * att samma fråga går att skicka hit igen.
   */
  const senasteFran = useRef<string>('');
  useEffect(() => {
    const text = parametrar.fragaText;
    const n = parametrar.n ?? '';
    if (typeof text !== 'string' || text.trim() === '') return;
    if (senasteFran.current === n) return;
    senasteFran.current = n;
    setUtkast(text.trim());
  }, [parametrar.fragaText, parametrar.n]);

  // Samtalen läses om varje gång fliken visas, så panelen aldrig är inaktuell.
  const hamtaSamtal = useCallback(() => {
    void (async () => setSamtal(await lasSamtalen()))();
  }, []);
  useFocusEffect(hamtaSamtal);

  /**
   * Uträkningen som kommer hem från Räkna (rev-ux 5.6, direktiv 40 steg 6).
   *
   * Chatten lämnade över en fråga och minns när. Räkna räknar och sparar
   * posten i historiken; när den syns här läggs den i tråden som ett
   * innehållskort. Kortet bär bara id:t — svaret läses ur historiken, så en
   * post som ändras eller tas bort inte står kvar som en kopia i chatten.
   */
  useEffect(() => {
    const vantar = overlamnat.current;
    if (vantar === null) return;
    const redan = meddelanden.flatMap((m) => (m.raknatId === undefined ? [] : [m.raknatId]));
    const post = hittaRaknat(historik, vantar, redan);
    if (post === null) return;
    overlamnat.current = null;
    const nar = Date.parse(post.datum);
    const kort: Meddelande = {
      roll: 'du',
      at: Number.isNaN(nar) ? Date.now() : nar,
      // Texten är kortets innehåll i ord, för VoiceOver och för en läsare
      // som saknar posten.
      text: `${post.resultat} — ${post.etikett}`,
      raknatId: post.id,
    };
    const hela = [...meddelanden, kort];
    setMeddelanden(hela);
    // Den stora handlingen landar (rev-ux 5.6 och haptikkartan).
    haptic('bekraftelse');
    void sparaSamtal(hela);
    // Bara historiken och tråden styr. sparaSamtal skriver om hela tråden
    // och är avsiktligt utanför: den läser inget av det effekten beror på.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historik, meddelanden]);

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

    // Direktiv 40: tiden foljer med meddelandet. Den star i bubblan och
    // avgor gruppen och datumrubriken (rev-ux 5.2).
    const trad: readonly Meddelande[] = [
      ...meddelanden,
      { roll: 'jag', text: fragan, at: Date.now() },
    ];
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
          // Minuttaket per IP (direktiv 30). Det släpper inom en minut, så
          // frågan är kvar och svaret säger hur länge — dygnsvyn 21e vore
          // fel besked för ett tak som gäller en stund.
          if (slut.sort === 'for-snabbt') {
            haptik('varning');
            const sekunder = Math.max(1, Math.ceil(slut.retryAfter));
            const svar: Meddelande = {
              roll: 'du',
              at: Date.now(),
              text: `För många frågor på kort tid. Försök igen om ${sekunder} sekunder — frågan är kvar.`,
            };
            const hela = [...trad, svar];
            setMeddelanden(hela);
            void sparaSamtal(hela);
            return;
          }
          if (slut.sort === 'fel') {
            haptik('varning');
            const svar: Meddelande = {
              roll: 'du',
              at: Date.now(),
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
            at: Date.now(),
            text: samlat,
            ...(slut.sort === 'klart' && slut.raknaPa !== undefined
              ? { raknaPa: slut.raknaPa }
              : {}),
            // Direktiv 36: id:t sparas med meddelandet, så att kortet
            // "Räkna på det" bär det också när tråden öppnas igen.
            ...(slut.sort === 'klart' && slut.tolkningsId !== undefined
              ? { tolkningsId: slut.tolkningsId }
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
    overlamnat.current = null;
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
          onRaknaPa={(fraga, tolkningsId) => {
            // Räkna äger räkningen. Frågan följer med som parameter, och
            // nonsen gör att samma fråga går att skicka igen. Direktiv 36:
            // id:t till serverns tolkning följer med, så att Räkna räknar på
            // samma tolkning som chatten provade.
            stromningen.current?.stoppa();
            overlamnat.current = { fraga, nar: Date.now() };
            router.navigate({
              pathname: '/',
              params: {
                raknaPa: fraga,
                n: String(Date.now()),
                ...(tolkningsId === undefined ? {} : { tolkningsId }),
              },
            });
          }}
          onBytTillRakna={() => router.navigate('/')}
          samtal={samtal}
          aktivtSamtal={aktivtId}
          onOppnaSamtal={(s) => {
            stromningen.current?.stoppa();
            // Ett annat samtal öppnas: en uträkning som är på väg hem hör
            // till tråden den lämnades ifrån, inte till den som öppnas nu.
            overlamnat.current = null;
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
          raknade={historik}
          onOppnaRaknat={setOppenPost}
        />
      </View>

      {/*
        Resultatarket ur tråden (direktiv 40 steg 6). Samma begränsning som i
        Historik: posten bär svaret, inte indata, så "Räkna om" finns inte —
        och "Räkna vidare" lämnar frågan till Räkna, som räknar om den.
      */}
      {oppenPost === null ? null : (
        <ResultatSheet
          oppen={!delaOppen}
          fraga={oppenPost.fraga}
          etikett={oppenPost.etikett}
          resultat={postSomResultat(oppenPost)}
          forklaring={oppenPost.forklaring}
          onStang={() => setOppenPost(null)}
          onNyFraga={() => {
            setOppenPost(null);
            router.navigate('/');
          }}
          onRaknaOm={() => undefined}
          onDela={() => setDelaOppen(true)}
          onRaknaVidare={() => {
            const fragan = oppenPost.fraga;
            setOppenPost(null);
            router.navigate({ pathname: '/', params: { raknaPa: fragan, n: String(Date.now()) } });
          }}
        />
      )}

      {/* Vy 10: dela uträkningen. Inget skickas till vår server. */}
      {oppenPost === null ? null : (
        <DelaSheet
          oppen={delaOppen}
          onStang={() => setDelaOppen(false)}
          innehall={{
            fraga: oppenPost.fraga,
            ...delningsbildensHuvudsvar(postSomResultat(oppenPost), oppenPost.etikett),
            villkor: oppenPost.villkor ?? [],
            rader: delningsbildensRader(postSomResultat(oppenPost)),
          }}
        />
      )}
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
