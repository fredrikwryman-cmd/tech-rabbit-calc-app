/**
 * Räkna-fliken: vy 20 (hem), 03, 04a, 04b, 05 och 06.
 *
 * I v4 är Räkna bara räkning igen: lägessegmentet Räkna | Fråga är borta, och
 * chatten har en egen flik. Hem bär premiumkortet som öppnar Rabbit AI (20).
 *
 * Flödet är ett läge i taget:
 *   hem → raknar → (en-sak-till → raknar)* → resultat
 *                → fel
 *
 * Tolkningen går via lib/aktiv-tolkare.ts: tolkningstjänsten i apps/api när
 * EXPO_PUBLIC_API_URL är satt, annars stubParser i utvecklingsbyggen. Den här
 * filen känner bara gränssnittet Tolkare, inte vem som svarar.
 *
 * ## Löpnumret
 *
 * Varje räkning får ett nummer. Ett svar tas emot bara när numret fortfarande
 * är det senaste. Avbryter användaren, trycker Räkna två gånger, eller svarar
 * på en följdfråga medan det förra anropet är ute, så kan ett gammalt svar
 * komma först — och det får aldrig skriva över ett nyare. Numret är hela
 * skyddet: `fetch` avbryts inte, men svaret kastas.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInputInstance,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Network from 'expo-network';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTema } from '../../design/tema';
import { TEXT } from '../../design/tokens';
import { Felvy, felvysortFor, garAttForsokaIgen } from '../../komponenter/Felvy';
import { Fragefalt, Svarsfalt } from '../../komponenter/Falt';
import { DelaSheet } from '../../komponenter/Delning';
import { DinFragaKort, Exempelkort, Premiumkort, type Exempel } from '../../komponenter/Kort';
import { PrimarKnapp, SekundarKnapp } from '../../komponenter/Knapp';
import { Progressteg, type Stegtillstand } from '../../komponenter/Progress';
import { SkrivSjalv, Valknapp } from '../../komponenter/Resultatdelar';
import { RaknaVidareSheet } from '../../komponenter/RaknaVidare';
import { ResultatSheet } from '../../komponenter/ResultatSheet';
import { Lyssnarkort, Mikrofonknapp, Rostbesked } from '../../komponenter/Rost';
import { medFelgrans } from '../../komponenter/Felgrans';
import { Skarm } from '../../komponenter/Skarm';
import { steg3Ms, stegbyteMs, tolkare } from '../../lib/aktiv-tolkare';
import { useApp } from '../../lib/app-state';
import { lasUtkast, skrivUtkast } from '../../lib/lagring';
import { REDUCERAD_MS, useHaptik, useRorelse, YTA_MS } from '../../lib/rorelse';
import { useRost } from '../../lib/rost';
import { delningsbildensHuvudsvar, delningsbildensRader } from '../../lib/resultatvy';
import { andringsmarke, byggVidareFraga } from '../../lib/vidare';
import type { Foljdfraga, Foljdsvar, Svar, Tolkningssvar } from '../../lib/tolkning';

/**
 * Exempelkorten på Hem. Bara Vinstmarginal och Ränta, enligt direktivet.
 * Moms och Timpris finns i designbilden men ingår inte i den här delen.
 */
const EXEMPEL: readonly Exempel[] = [
  {
    titel: 'Vinstmarginal',
    rad: 'Köp 40 kr, sälj 65 kr',
    fraga: 'Köp 40 kr, sälj 65 kr. Vad är marginalen?',
  },
  {
    titel: 'Ränta',
    rad: '3,5 % på 200 000 kr',
    fraga: '3,5 % ränta på 200 000 kr i ett år',
  },
];

/** Stegen i vy 03. Verkliga skeden, ingen procentsiffra. */
const STEG = ['Tolkar din fråga', 'Räknar', 'Förbereder förklaring'] as const;

type Stegnr = 1 | 2 | 3;

/**
 * Ett tidigare svar i en kedja av Räkna vidare (05d).
 *
 * Svepet åt höger går tillbaka hit. Kedjan ligger i vyn och sparas inte:
 * den hör till det man håller på med just nu, inte till historiken.
 */
interface Vidaresteg {
  readonly svar: Svar;
  readonly andrat: string | null;
  readonly stalld: string;
}

type Lage =
  | { readonly sort: 'hem' }
  | { readonly sort: 'raknar'; readonly steg: Stegnr }
  | { readonly sort: 'en-sak-till'; readonly foljdfraga: Foljdfraga }
  | { readonly sort: 'fel'; readonly fel: Tolkningssvar & { sort: 'fel' } };

function RaknaSkarm(): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const haptik = useHaptik();
  const { laggTill } = useApp();
  const router = useRouter();
  /** 21d: frågan Rabbit AI lämnade över. `n` gör att samma fråga kan komma igen. */
  const parametrar = useLocalSearchParams<{ raknaPa?: string; n?: string }>();

  const [fraga, setFraga] = useState('');
  const [fokus, setFokus] = useState(false);
  const [lage, setLage] = useState<Lage>({ sort: 'hem' });
  const [svar, setSvar] = useState<Svar | null>(null);
  const [foljdsvar, setFoljdsvar] = useState('');
  /** Hela kedjan av svar på följdfrågor. Servern är tillståndslös. */
  const [kedja, setKedja] = useState<readonly Foljdsvar[]>([]);
  /** F05: tolkningen servern redan gjort, tillbaka oförändrad. */
  const [kant, setKant] = useState<unknown>(undefined);
  /** 04b: användaren valde "Skriv själv" i stället för en valknapp. */
  const [skrivSjalv, setSkrivSjalv] = useState(false);
  /**
   * Hela frågan som faktiskt ställdes, med alla tillägg från Räkna vidare.
   * Fältet bär kvar den ursprungliga frågan, så de två skiljer sig åt så
   * fort man räknat vidare en gång — och nästa ändring ska bygga på den här.
   */
  const [stalld, setStalld] = useState('');
  /** 05d: senaste ändringen i användarens egna ord, till det gröna märket. */
  const [andrat, setAndrat] = useState<string | null>(null);
  /** Tidigare svar i kedjan, äldst först. Tomt när inget räknats vidare. */
  const [tidigare, setTidigare] = useState<readonly Vidaresteg[]>([]);
  const [vidareOppen, setVidareOppen] = useState(false);
  const [delaOppen, setDelaOppen] = useState(false);
  const fragefaltet = useRef<TextInputInstance>(null);

  /** Löpnumret. Se filhuvudet: det är skyddet mot sena svar. */
  const lopnummer = useRef(0);

  /**
   * Rösten (vy 40 och 41).
   *
   * Texten skrivs rakt in i frågefältet medan man pratar. Ingenting skickas:
   * användaren trycker själv på Räkna. Finns inte stödet — Expo Go — säger
   * knappen det i stället för att krascha.
   */
  const rost = useRost({ onText: setFraga });

  const kanRakna = fraga.trim().length > 0;

  // ------------------------------------------------------------- utkastet
  // Läses en gång vid start, och bara när fältet fortfarande är tomt: hinner
  // användaren skriva innan lagringen svarat ska inget skrivas över.
  useEffect(() => {
    let kvar = true;
    void (async () => {
      const sparad = await lasUtkast();
      if (kvar && sparad.trim() !== '') setFraga((n) => (n === '' ? sparad : n));
    })();
    return () => {
      kvar = false;
    };
  }, []);

  useEffect(() => {
    void skrivUtkast(fraga);
  }, [fraga]);

  /**
   * 21d: Rabbit AI lämnade över en räknefråga.
   *
   * Frågan kommer som parameter i stället för genom ett delat tillstånd:
   * flikarna lever var för sig, och det här är den enda vägen mellan dem.
   * `n` är ett löpnummer, så att samma fråga går att skicka om.
   */
  const senasteOverlamnad = useRef<string>('');
  useEffect(() => {
    const text = parametrar.raknaPa;
    const n = parametrar.n ?? '';
    if (typeof text !== 'string' || text.trim() === '') return;
    if (senasteOverlamnad.current === n) return;
    senasteOverlamnad.current = n;
    setSvar(null);
    setKedja([]);
    setKant(undefined);
    setSkrivSjalv(false);
    setAndrat(null);
    setTidigare([]);
    void raknaFraga(text);
    // raknaFraga ar stabil nog: den laser ingen state som behover bevakas har.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametrar.raknaPa, parametrar.n]);

  /** Vy 06a visas när enheten saknar nätverk. */
  async function harNat(): Promise<boolean> {
    try {
      const n = await Network.getNetworkStateAsync();
      // isInternetReachable är odefinierad innan det är avgjort: tro på isConnected då.
      return n.isInternetReachable ?? n.isConnected ?? true;
    } catch {
      // Går det inte att fråga är det inte nätet som är felet.
      return true;
    }
  }

  function tillampa(resultat: Tolkningssvar, stalldFraga: string): void {
    if (resultat.sort === 'fel') {
      haptik('varning');
      setLage({ sort: 'fel', fel: resultat });
      return;
    }
    if (resultat.sort === 'foljdfraga') {
      setFoljdsvar(resultat.forslag ?? '');
      setSkrivSjalv(false);
      // Behåll det servern redan förstått, så inget frågas två gånger.
      if (resultat.kant !== undefined) setKant(resultat.kant);
      setLage({ sort: 'en-sak-till', foljdfraga: resultat });
      return;
    }

    haptik('bekraftelse');
    setSvar(resultat);
    setStalld(stalldFraga);
    setLage({ sort: 'hem' });
    // Frågan är besvarad: utkastet ska inte ligga kvar till nästa start.
    void skrivUtkast('');
    laggTill({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fraga: stalldFraga,
      resultat: `${resultat.resultat.formatted} ${resultat.resultat.unit}`,
      etikett: resultat.etikett,
      forklaring: resultat.forklaring,
      steg: resultat.resultat.steps.map((s) => ({
        nr: s.nr,
        etikett: s.etikett,
        uttryck: s.uttryck,
        resultat: s.resultat,
      })),
      // Ett gammalt resultat ska visas likadant som när det räknades.
      ...(resultat.resultat.villkor && resultat.resultat.villkor.length > 0
        ? { villkor: resultat.resultat.villkor }
        : {}),
      ...(resultat.resultat.praktiskt
        ? {
            praktiskt: {
              formatted: resultat.resultat.praktiskt.formatted,
              unit: resultat.resultat.praktiskt.unit,
              skal: resultat.resultat.praktiskt.skal,
            },
          }
        : {}),
      ...(resultat.resultat.exakt
        ? {
            exakt: {
              formatted: resultat.resultat.exakt.formatted,
              unit: resultat.resultat.exakt.unit,
              skal: resultat.resultat.exakt.skal,
            },
          }
        : {}),
      // Fakta och rader sparas med posten, sa att vyerna 30-33 oppnas ratt
      // ocksa fran Historik (direktiv 23).
      ...(resultat.resultat.fakta && resultat.resultat.fakta.length > 0
        ? {
            fakta: resultat.resultat.fakta.map((f) => ({
              nyckel: f.nyckel,
              betydelse: f.betydelse,
              value: f.value,
              formatted: f.formatted,
              unit: f.unit,
            })),
          }
        : {}),
      ...(resultat.resultat.rader && resultat.resultat.rader.length > 0
        ? {
            rader: resultat.resultat.rader.map((r) => ({
              etikett: r.etikett,
              formatted: r.formatted,
              unit: r.unit,
              value: r.value,
            })),
          }
        : {}),
      datum: new Date().toISOString(),
    });
  }

  /**
   * Räknar frågan.
   *
   * `nyKedja` är hela kedjan av svar på följdfrågor, inte bara det senaste:
   * servern äger inget mellan två anrop. Dubbeltryck på Räkna ger inte två
   * historikposter, eftersom bara det sista löpnumret får lämna ett svar.
   */
  async function rakna(nyKedja?: readonly Foljdsvar[]): Promise<void> {
    const stalldFraga = fraga.trim();
    if (!stalldFraga) return;
    haptik('latt');

    const mitt = (lopnummer.current += 1);
    const aktuell = (): boolean => lopnummer.current === mitt;

    const kedjaNu = nyKedja ?? kedja;
    setKedja(kedjaNu);
    // En ny räkning är inte en fortsättning: märket och kedjan nollställs.
    setAndrat(null);
    setTidigare([]);
    setLage({ sort: 'raknar', steg: 1 });

    const natet = await harNat();
    const till2 = setTimeout(() => {
      if (aktuell()) setLage((l) => (l.sort === 'raknar' ? { sort: 'raknar', steg: 2 } : l));
    }, stegbyteMs);
    const till3 = setTimeout(() => {
      if (aktuell()) setLage((l) => (l.sort === 'raknar' ? { sort: 'raknar', steg: 3 } : l));
    }, steg3Ms);

    try {
      const resultat = await tolkare.tolka(stalldFraga, {
        harNat: natet,
        ...(kedjaNu.length > 0 ? { foljdsvar: kedjaNu } : {}),
        ...(kant !== undefined ? { tidigareTolkning: kant } : {}),
      });
      // Ett svar på en avbruten eller ersatt fråga kastas. Tyst: användaren
      // har redan gått vidare och ska inte få veta att det kom.
      if (!aktuell()) return;
      tillampa(resultat, stalldFraga);
    } finally {
      clearTimeout(till2);
      clearTimeout(till3);
    }
  }

  /**
   * Räknar en fråga som inte står i fältet än, t.ex. ett "Menade du?"-förslag.
   *
   * Fältet sätts först, men React hinner inte skriva om `fraga` innan `rakna`
   * läser den. Därför tar den här texten som argument.
   */
  async function raknaFraga(text: string, visaIFalt = true): Promise<void> {
    // Räkna vidare skickar hela frågan med sina tillägg, men fältet ska
    // fortsätta visa den ursprungliga frågan (05d).
    if (visaIFalt) setFraga(text);
    const mitt = (lopnummer.current += 1);
    const aktuell = (): boolean => lopnummer.current === mitt;
    haptik('latt');
    setKedja([]);
    setLage({ sort: 'raknar', steg: 1 });
    const natet = await harNat();
    const till2 = setTimeout(() => {
      if (aktuell()) setLage((l) => (l.sort === 'raknar' ? { sort: 'raknar', steg: 2 } : l));
    }, stegbyteMs);
    const till3 = setTimeout(() => {
      if (aktuell()) setLage((l) => (l.sort === 'raknar' ? { sort: 'raknar', steg: 3 } : l));
    }, steg3Ms);
    try {
      const resultat = await tolkare.tolka(text, { harNat: natet });
      if (!aktuell()) return;
      tillampa(resultat, text);
    } finally {
      clearTimeout(till2);
      clearTimeout(till3);
    }
  }

  /**
   * 05c: räknar vidare på svaret.
   *
   * Ändringen läggs till den fråga som faktiskt ställdes, och HELA frågan
   * tolkas om. Motorn räknar och AI:n tolkar precis som första gången: det
   * finns ingen egen räkning och inget nytt API här.
   */
  async function raknaVidare(andring: string): Promise<void> {
    const bas = stalld.trim() === '' ? fraga.trim() : stalld.trim();
    const ny = byggVidareFraga(bas, andring);
    if (ny === bas) return;
    setVidareOppen(false);
    // Det svar man står på läggs undan, så svepet kan gå tillbaka till det.
    const forra = svar;
    if (forra !== null) {
      setTidigare((t) => [...t, { svar: forra, andrat, stalld: bas }]);
    }
    setAndrat(andringsmarke(andring));
    setSvar(null);
    await raknaFraga(ny, false);
  }

  /** Svep åt höger i 05d: tillbaka till det förra svaret i kedjan. */
  function foregaendeSvar(): void {
    const forra = tidigare[tidigare.length - 1];
    if (forra === undefined) return;
    haptik('latt');
    lopnummer.current += 1;
    setTidigare((t) => t.slice(0, -1));
    setSvar(forra.svar);
    setAndrat(forra.andrat);
    setStalld(forra.stalld);
  }

  /** Avbryt i vy 03. Numret höjs, så svaret som är ute kastas när det kommer. */
  function avbryt(): void {
    lopnummer.current += 1;
    haptik('latt');
    setLage({ sort: 'hem' });
    setTimeout(() => fragefaltet.current?.focus(), 50);
  }

  function svaraFoljdfraga(f: Foljdfraga, varde: string): void {
    const trimmat = varde.trim();
    if (trimmat === '') return;
    void rakna([...kedja, { fraga: f.fraga, varde: trimmat }]);
  }

  function nyFraga(): void {
    lopnummer.current += 1;
    setSvar(null);
    setStalld('');
    setAndrat(null);
    setTidigare([]);
    setVidareOppen(false);
    setDelaOppen(false);
    setFraga('');
    setFoljdsvar('');
    setKedja([]);
    setKant(undefined);
    setSkrivSjalv(false);
    setLage({ sort: 'hem' });
    void skrivUtkast('');
  }

  // -------------------------------------------------------------------------
  // Vy 03: Räknar
  // -------------------------------------------------------------------------
  if (lage.sort === 'raknar') {
    const tillstand = (nr: Stegnr): Stegtillstand =>
      lage.steg > nr ? 'klar' : lage.steg === nr ? 'pagar' : 'vantar';
    return (
      <Skarm rubrik="Räknar …">
        <Animated.View
          entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS)}
          style={styles.spalt}
        >
          <DinFragaKort fraga={fraga} fallbart={false} />
          <View style={[styles.kort, { backgroundColor: farg['card'] }]}>
            {STEG.map((titel, i) => (
              <Progressteg
                key={titel}
                nr={(i + 1) as Stegnr}
                titel={titel}
                tillstand={tillstand((i + 1) as Stegnr)}
                forst={i === 0}
                tid={i === 0 ? stegbyteMs : steg3Ms - stegbyteMs}
              />
            ))}
          </View>
          <Text maxFontSizeMultiplier={1.6} style={[TEXT['body'], styles.mitten, { color: farg['muted'] }]}>
            Det brukar ta några sekunder.
          </Text>
          <View style={styles.fyll} />
          {/* Avbryt syns under hela Räknar och ligger stilla. */}
          <SekundarKnapp titel="Avbryt" onPress={avbryt} />
        </Animated.View>
      </Skarm>
    );
  }

  // -------------------------------------------------------------------------
  // Vy 06: Fel
  // -------------------------------------------------------------------------
  if (lage.sort === 'fel') {
    const f = lage.fel;
    const sort = felvysortFor(f.typ);
    const igen = garAttForsokaIgen(sort);
    const forsokIgen = <PrimarKnapp titel="Försök igen" onPress={() => void rakna()} />;
    const skrivOm = (
      <SekundarKnapp
        titel="Skriv om frågan"
        onPress={() => {
          setLage({ sort: 'hem' });
          setTimeout(() => fragefaltet.current?.focus(), 50);
        }}
      />
    );
    /**
     * Direktiv 30: ingen återvändsgränd.
     *
     * 06d och 06e hade bara "Skriv om frågan", och en fråga räknaren inte
     * har ett räknesätt för blir inte bättre av att skrivas om. Rabbit AI
     * kan söka upp det som saknas, eller svara själv. Knappen byter flik och
     * lägger frågan i chattens fält — användaren trycker Skicka själv, så
     * ingen fråga skickas i någons rygg.
     */
    const fragaRabbit = (
      <SekundarKnapp
        titel="Fråga Rabbit AI"
        onPress={() => {
          router.navigate({
            pathname: '/rabbit-ai',
            params: { fragaText: fraga, n: String(Date.now()) },
          });
        }}
      />
    );
    // Frågan ligger alltid kvar, i varje felvy.
    return (
      <Skarm>
        <View style={styles.spalt}>
          <DinFragaKort fraga={fraga} />
          <Felvy
            sort={sort}
            {...(f.meddelande !== undefined ? { meddelande: f.meddelande } : {})}
            {...(f.retryAfter !== undefined ? { retryAfter: f.retryAfter } : {})}
            {...(f.forslag !== undefined ? { forslag: f.forslag } : {})}
            onForslag={(forslaget) => {
              // Förslagen är redan provade mot räknemotorn på servern, så ett
              // tryck leder aldrig tillbaka hit.
              setFraga(forslaget);
              setKedja([]);
              setKant(undefined);
              lopnummer.current += 1;
              setLage({ sort: 'hem' });
              setTimeout(() => void raknaFraga(forslaget), 0);
            }}
            knappar={
              sort === '06d' || sort === '06e' || sort === '06f' ? (
                <>
                  {skrivOm}
                  {sort === '06d' || sort === '06e' ? fragaRabbit : null}
                  {igen ? <SekundarKnapp titel="Försök igen" onPress={() => void rakna()} /> : null}
                </>
              ) : (
                <>
                  {forsokIgen}
                  {skrivOm}
                </>
              )
            }
          />
        </View>
      </Skarm>
    );
  }

  // -------------------------------------------------------------------------
  // Vy 04a och 04b: En sak till
  // -------------------------------------------------------------------------
  if (lage.sort === 'en-sak-till') {
    const f = lage.foljdfraga;
    const val = f.choices ?? [];
    // 04b: valknapparna ÄR handlingen, så vyn har ingen primärknapp alls.
    const tvetydigt = val.length >= 2 && !skrivSjalv;

    return (
      <Skarm rubrik="En sak till">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.spalt}
        >
          <Animated.View
            entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : 280)}
            style={styles.spalt}
          >
            <DinFragaKort fraga={fraga} />
            <View style={[styles.kort, styles.kortpadding, { backgroundColor: farg['card'] }]}>
              <View
                style={[
                  styles.marke,
                  { backgroundColor: farg['warnSoft'] },
                ]}
              >
                <Text
                  maxFontSizeMultiplier={1.4}
                  style={[styles.marketext, { color: farg['warnText'] }]}
                >
                  {tvetydigt ? 'Två tolkningar' : 'Behöver ett värde'}
                </Text>
              </View>
              <Text maxFontSizeMultiplier={1.6} style={[TEXT['question'], { color: farg['text'] }]}>
                {f.fraga}
              </Text>

              {/* F07: raden "Varför jag frågar", in 80 ms efter kortet. */}
              {f.reason !== undefined && f.reason !== '' ? (
                <Animated.View
                  entering={FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS).delay(
                    rorelse.reducerad ? 0 : 80,
                  )}
                >
                  {tvetydigt ? null : (
                    <Text
                      maxFontSizeMultiplier={1.5}
                      style={[TEXT['sectionLabel'], styles.versal, { color: farg['muted'] }]}
                    >
                      Varför jag frågar
                    </Text>
                  )}
                  <Text
                    maxFontSizeMultiplier={1.6}
                    style={[TEXT['secondary'], styles.reason, { color: farg['muted'] }]}
                  >
                    {f.reason}
                  </Text>
                </Animated.View>
              ) : null}

              {tvetydigt ? null : (
                <Svarsfalt
                  varde={foljdsvar}
                  onChange={setFoljdsvar}
                  enhet={f.enhet}
                  etikett={f.fraga}
                  autoFokus={!rorelse.reducerad}
                />
              )}
            </View>

            {/* 04b: valknappar, inget förvalt, plus Skriv själv. */}
            {tvetydigt ? (
              <View style={styles.valspalt}>
                {val.map((v, i) => (
                  <Valknapp
                    key={v.id}
                    titel={v.titel}
                    under={v.under}
                    vald={false}
                    ordning={i}
                    onPress={() => {
                      haptik('latt');
                      svaraFoljdfraga(f, v.titel);
                    }}
                  />
                ))}
                <SkrivSjalv
                  ordning={val.length}
                  onPress={() => {
                    setSkrivSjalv(true);
                    setTimeout(() => fragefaltet.current?.focus(), 50);
                  }}
                />
              </View>
            ) : null}

            <View style={styles.fyll} />
            {tvetydigt ? null : (
              <PrimarKnapp
                titel="Fortsätt"
                inaktiv={foljdsvar.trim().length === 0}
                onPress={() => svaraFoljdfraga(f, foljdsvar)}
              />
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Skarm>
    );
  }

  // -------------------------------------------------------------------------
  // Vy 01 och 02: Hem
  // -------------------------------------------------------------------------
  return (
    <>
      <Skarm rubrik="Vad vill du räkna?" stor>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.spalt}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.spalt}>
            <Fragefalt
              ref={fragefaltet}
              varde={fraga}
              onChange={setFraga}
              fokus={fokus}
              onFokus={setFokus}
              lyssnar={rost.lage === 'lyssnar'}
              mikrofon={
                <Mikrofonknapp
                  lage={rost.lage}
                  onStarta={rost.starta}
                  onStoppa={rost.stoppa}
                />
              }
            />

            {/* Vy 40: lyssnarkortet. Vy 41 och beskedet om testappen. */}
            {rost.lage === 'lyssnar' ? (
              <Lyssnarkort niva={rost.niva} onKlar={rost.stoppa} />
            ) : null}
            <Rostbesked
              lage={rost.lage}
              onStang={rost.nollstall}
              onOppnaInstallningar={rost.oppnaInstallningar}
            />

            <PrimarKnapp titel="Räkna" inaktiv={!kanRakna} onPress={() => void rakna([])} />

            <Text
              maxFontSizeMultiplier={1.6}
              style={[TEXT['sectionLabel'], styles.versal, { color: farg['muted'] }]}
            >
              Exempel
            </Text>
            <View style={styles.exempelrad}>
              {EXEMPEL.map((e) => (
                <Exempelkort
                  key={e.titel}
                  exempel={e}
                  onPress={(ny) => {
                    // Texten tonas in i fältet: samma 200 ms som ytor i övrigt.
                    setFraga(ny);
                  }}
                />
              ))}
            </View>

            {/* Vy 20: premiumkortet. Hela kortet öppnar fliken Rabbit AI. */}
            <Premiumkort onPress={() => router.navigate('/rabbit-ai')} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Skarm>

      {svar ? (
        <ResultatSheet
          // Bara en sheet i taget: en modal ovanpå en annan modal visas inte
          // tillförlitligt på iOS. Resultatet kommer tillbaka när den andra
          // stängs, med allt innehåll kvar.
          oppen={!vidareOppen && !delaOppen}
          fraga={fraga}
          etikett={svar.etikett}
          resultat={svar.resultat}
          forklaring={svar.forklaring}
          onStang={() => setSvar(null)}
          onNyFraga={nyFraga}
          onRaknaVidare={() => setVidareOppen(true)}
          onDela={() => setDelaOppen(true)}
          {...(andrat !== null ? { andrat } : {})}
          antalTidigare={tidigare.length}
          onForegaende={foregaendeSvar}
          onRaknaOm={(andrade) => {
            // Ändringarna går tillbaka som svar på följdfrågor: servern tolkar
            // om med dem som extra upplysning. Appen räknar aldrig själv.
            const extra: Foljdsvar[] = Object.entries(andrade)
              .filter(([, v]) => v.trim() !== '')
              .map(([nyckel, varde]) => ({
                fraga: etikettFor(svar, nyckel),
                varde: varde.trim(),
              }));
            if (extra.length === 0) return;
            setSvar(null);
            void rakna([...kedja, ...extra]);
          }}
        />
      ) : null}

      {/* Vy 05c: Räkna vidare. */}
      {svar ? (
        <RaknaVidareSheet
          oppen={vidareOppen}
          varde={svar.resultat.formatted}
          enhet={svar.resultat.unit}
          onStang={() => setVidareOppen(false)}
          onRakna={(andring) => void raknaVidare(andring)}
        />
      ) : null}

      {/* Vy 10: Dela svaret som bild. Inget skickas till vår server. */}
      {svar ? (
        <DelaSheet
          oppen={delaOppen}
          onStang={() => setDelaOppen(false)}
          innehall={{
            fraga: stalld.trim() === '' ? fraga : stalld,
            // Samma huvudsvar som skärmen, och i vy 31 också vem som
            // betalar vem (direktiv 25).
            ...delningsbildensHuvudsvar(svar.resultat, svar.etikett),
            villkor: svar.resultat.villkor ?? [],
            rader: delningsbildensRader(svar.resultat),
          }}
        />
      ) : null}
    </>
  );
}

/** Faktumets egen etikett, så att servern förstår vilket värde som ändrats. */
function etikettFor(svar: Svar, nyckel: string): string {
  const f = (svar.resultat.fakta ?? []).find((x) => x.nyckel === nyckel);
  return f ? f.betydelse : nyckel;
}

const styles = StyleSheet.create({
  spalt: { flex: 1, gap: 14 },
  kort: { borderRadius: 20, overflow: 'hidden' },
  kortpadding: { padding: 16, gap: 12, overflow: 'visible' },
  marke: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  marketext: { fontSize: 14, fontFamily: 'Archivo_800ExtraBold' },
  versal: { textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
  reason: { marginTop: 4 },
  valspalt: { gap: 10 },
  exempelrad: { flexDirection: 'row', gap: 10 },
  mitten: { textAlign: 'center' },
  fyll: { flex: 1 },
});

/**
 * Fliken ligger i en felgräns: ett fel i render visar ett kort med felets
 * text i stället för att stänga appen (direktiv 17).
 */
export default medFelgrans(RaknaSkarm, 'Räkna');
