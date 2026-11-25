/**
 * Historik-fliken: vy 07 (med rader) och vy 08 (tom).
 *
 * I v4 visar Historik bara uträkningar. Samtalen flyttade till panelen
 * "Tidigare samtal" i fliken Rabbit AI (21f).
 *
 * Raderna kommer ur AsyncStorage. Svep åt vänster eller …-menyn tar bort på
 * riktigt. Tryck på en rad öppnar uträkningen i resultat-sheeten igen.
 */

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { useTema } from '../../design/tema';
import { TEXT } from '../../design/tokens';
import { DelaSheet } from '../../komponenter/Delning';
import { medFelgrans } from '../../komponenter/Felgrans';
import { Historikrad } from '../../komponenter/Historikrad';
import { PrimarKnapp } from '../../komponenter/Knapp';
import { ResultatSheet } from '../../komponenter/ResultatSheet';
import { Skarm, useSkarmscroll } from '../../komponenter/Skarm';
import { useApp } from '../../lib/app-state';
import { grupperaPaDag, rubrikplatser } from '../../lib/historikgrupper';
import { postSomResultat, visaDatum, type Historikpost } from '../../lib/lagring';
import { delningsbildensHuvudsvar, delningsbildensRader } from '../../lib/resultatvy';
import { REDUCERAD_MS, useRorelse, YTA_MS } from '../../lib/rorelse';

function HistorikSkarm(): ReactNode {
  const { farg } = useTema();
  const rorelse = useRorelse();
  const router = useRouter();
  const { historik, taBort, laddat } = useApp();
  /** rev-ux 4.3: rubriken kollapsar och toppfaltet far avdelare vid scroll. */
  const skarmscroll = useSkarmscroll();
  const [oppen, setOppen] = useState<Historikpost | null>(null);
  const [delaOppen, setDelaOppen] = useState(false);
  /** Posterna i dagsgrupper, för de klistriga rubrikerna. */
  const grupper = useMemo(() => grupperaPaDag(historik), [historik]);

  const toning = FadeIn.duration(rorelse.reducerad ? REDUCERAD_MS : YTA_MS);

  // Vy 08: tom historik.
  if (laddat && historik.length === 0) {
    return (
      <Skarm rubrik="Historik">
        <Animated.View entering={toning} style={styles.tom}>
          <View style={styles.tomtext}>
            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={1.5}
              style={[TEXT['question'], { color: farg['text'] }]}
            >
              Ingen historik än
            </Text>
            <Text maxFontSizeMultiplier={1.8} style={[TEXT['body'], { color: farg['muted'] }]}>
              Dina uträkningar sparas här när du har räknat något.
            </Text>
          </View>
          <PrimarKnapp titel="Räkna något" onPress={() => router.navigate('/')} />
        </Animated.View>
      </Skarm>
    );
  }

  // Vy 07: historik med rader.
  return (
    <>
      <Skarm rubrik="Historik" scroll={skarmscroll.scroll}>
        <Animated.View entering={toning} style={styles.fyll}>
          <Animated.ScrollView
            contentContainerStyle={styles.lista}
            onScroll={skarmscroll.handler}
            scrollEventThrottle={16}
            stickyHeaderIndices={rubrikplatser(grupper.length)}
            /* Gummiband overst (rev-ux 4.3). */
            alwaysBounceVertical
          >
            {/*
              Klistriga datumrubriker (rev-ux 4.3 punkt 5, direktiv 41).
              Listan ritas som rubrik, kort, rubrik, kort … och
              `rubrikplatser` säger vilka barn som är rubriker. Grupperingen
              ligger i lib/historikgrupper.ts och delar rubriknamnen med
              chatten.
            */}
            {grupper.map((grupp) => (
              <Fragment key={grupp.nyckel}>
                <View style={[styles.datumrad, { backgroundColor: farg['bg'] }]}>
                  <Text
                    maxFontSizeMultiplier={1.4}
                    style={[styles.datumtext, { color: farg['muted'] }]}
                  >
                    {grupp.rubrik}
                  </Text>
                </View>
                <Animated.View
                  layout={
                    rorelse.reducerad
                      ? undefined
                      : LinearTransition.springify().damping(28).stiffness(220)
                  }
                  style={[styles.kort, { backgroundColor: farg['card'] }]}
                >
                  {grupp.poster.map((post, i) => (
                    <Historikrad
                      key={post.id}
                      fraga={post.fraga}
                      resultat={post.resultat}
                      datum={visaDatum(post.datum)}
                      forst={i === 0}
                      onPress={() => setOppen(post)}
                      onTaBort={() => taBort(post.id)}
                    />
                  ))}
                </Animated.View>
              </Fragment>
            ))}
            <Text maxFontSizeMultiplier={1.6} style={[TEXT['secondary'], { color: farg['muted'] }]}>
              Svep åt vänster eller tryck på … för att ta bort.
            </Text>
          </Animated.ScrollView>
        </Animated.View>
      </Skarm>

      {oppen ? (
        <ResultatSheet
          // Bara en sheet i taget: en modal ovanpå en annan visas inte
          // tillförlitligt på iOS.
          oppen={!delaOppen}
          fraga={oppen.fraga}
          etikett={oppen.etikett}
          resultat={postSomResultat(oppen)}
          forklaring={oppen.forklaring}
          onStang={() => setOppen(null)}
          onNyFraga={() => {
            setOppen(null);
            router.navigate('/');
          }}
          // En gammal post går inte att räkna om: indata sparas inte.
          onRaknaOm={() => undefined}
          onDela={() => setDelaOppen(true)}
          onRaknaVidare={() => {
            // Historiken sparar svaret, inte indata. Att räkna vidare kräver
            // ett levande resultat, så frågan lämnas över till Räkna-fliken,
            // som räknar om den — därefter går det att räkna vidare där.
            const fragan = oppen.fraga;
            setOppen(null);
            router.navigate({ pathname: '/', params: { raknaPa: fragan, n: String(Date.now()) } });
          }}
        />
      ) : null}

      {/* Vy 10: dela en sparad uträkning. Inget skickas till vår server. */}
      {oppen ? (
        <DelaSheet
          oppen={delaOppen}
          onStang={() => setDelaOppen(false)}
          innehall={{
            fraga: oppen.fraga,
            ...delningsbildensHuvudsvar(postSomResultat(oppen), oppen.etikett),
            villkor: oppen.villkor ?? [],
            rader: delningsbildensRader(postSomResultat(oppen)),
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fyll: { flex: 1 },
  lista: { paddingBottom: 20 },
  /* Rubriken klistrar sig: den måste ha en egen bakgrund att ligga mot. */
  datumrad: { paddingTop: 10, paddingBottom: 6 },
  datumtext: {
    fontSize: 12,
    fontFamily: 'Archivo_700Bold',
    letterSpacing: 0.4,
    includeFontPadding: false,
  },
  kort: { borderRadius: 20, overflow: 'hidden' },
  tom: { flex: 1, justifyContent: 'space-between' },
  tomtext: { flex: 1, justifyContent: 'center', gap: 8 },
});

/**
 * Fliken ligger i en felgräns: ett fel i render visar ett kort med felets
 * text i stället för att stänga appen (direktiv 17).
 */
export default medFelgrans(HistorikSkarm, 'Historik');
