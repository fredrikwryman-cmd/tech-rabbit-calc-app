/**
 * Flikikonerna, ritade efter design/vyer/.
 *
 * Ikonstorlek 25 enligt KOMPONENTER.md. Ritade som streck i stället för
 * importerade, så att de följer temats färg utan extra beroenden.
 */

import type { ReactNode } from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { LOGO_BANOR, LOGO_VIEWBOX } from '../design/logotyp';

const STORLEK = 25;
const TJOCKLEK = 1.9;

export interface IkonProps {
  readonly farg: string;
  readonly storlek?: number;
}

/** Räkna: en miniräknare. */
export function IkonRakna({ farg, storlek = STORLEK }: IkonProps): ReactNode {
  return (
    <Svg width={storlek} height={storlek} viewBox="0 0 24 24" fill="none">
      <Rect
        x={4.5}
        y={2.5}
        width={15}
        height={19}
        rx={3}
        stroke={farg}
        strokeWidth={TJOCKLEK}
      />
      <Rect x={7.5} y={5.5} width={9} height={3.5} rx={1} stroke={farg} strokeWidth={1.4} />
      {[12.5, 16, 19].map((y) =>
        [8.5, 12, 15.5].map((x) => (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.05} fill={farg} />
        )),
      )}
    </Svg>
  );
}

/** Historik: en klocka. */
export function IkonHistorik({ farg, storlek = STORLEK }: IkonProps): ReactNode {
  return (
    <Svg width={storlek} height={storlek} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={farg} strokeWidth={TJOCKLEK} />
      <Path
        d="M12 6.8V12l3.6 2.2"
        stroke={farg}
        strokeWidth={TJOCKLEK}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Inställningar: en sol. */
export function IkonInstallningar({ farg, storlek = STORLEK }: IkonProps): ReactNode {
  const strålar = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg width={storlek} height={storlek} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={4.2} stroke={farg} strokeWidth={TJOCKLEK} />
      {strålar.map((grader) => {
        const r = (grader * Math.PI) / 180;
        const x = Math.cos(r);
        const y = Math.sin(r);
        return (
          <Line
            key={grader}
            x1={12 + x * 7}
            y1={12 + y * 7}
            x2={12 + x * 9.6}
            y2={12 + y * 9.6}
            stroke={farg}
            strokeWidth={TJOCKLEK}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

/**
 * Rabbit AI: kaninsymbolen med en gnista uppe till höger (v4).
 *
 * KOMPONENTER.md v4: symbolen 20 pt med gnistan i `greenIcon`. Ovald flik är
 * gråskala med 75 % opacitet, vilket anroparen styr genom att skicka samma
 * färg i `farg` och `gnista`.
 */
export function IkonRabbitAI({
  farg,
  gnista,
  storlek = STORLEK,
  detalj,
}: IkonProps & { readonly gnista: string; readonly detalj?: string }): ReactNode {
  const vb = LOGO_VIEWBOX.split(' ').map(Number);
  const bredd = vb[2] ?? 1000;
  const hojd = vb[3] ?? 927;
  // Ritas i rutan 25 x 25. Symbolen är 20 bred, så att gnistan får plats
  // ovanför det högra örat.
  const skala = 20 / bredd;
  const y = (25 - hojd * skala) / 2 + 2;

  return (
    <Svg width={storlek} height={storlek} viewBox="0 0 25 25" fill="none">
      <G transform={`translate(0 ${y}) scale(${skala})`}>
        {LOGO_BANOR.map((bana, i) => (
          <Path
            key={i}
            d={bana.d}
            fillRule={bana.fillRule}
            fill={i === 0 ? farg : (detalj ?? gnista)}
          />
        ))}
      </G>
      {/* Gnistan: en fyrstrålig stjärna. */}
      <Path
        d="M19.6 1.4 20.45 3.75 22.8 4.6 20.45 5.45 19.6 7.8 18.75 5.45 16.4 4.6 18.75 3.75z"
        fill={gnista}
      />
    </Svg>
  );
}
