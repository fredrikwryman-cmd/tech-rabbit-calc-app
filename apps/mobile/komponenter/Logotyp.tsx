/**
 * TechRabbit-symbolen.
 *
 * Banorna kommer ur design/kalla/TechRabbit-logo-v1/symbol/ via
 * design/logotyp.ts. Kroppen får temats textfärg, detaljen den gröna.
 */

import type { ReactNode } from 'react';
import Svg, { Path } from 'react-native-svg';

import { LOGO_BANOR, LOGO_VIEWBOX } from '../design/logotyp';
import { useTema } from '../design/tema';
import { SIZE } from '../design/tokens';

const STANDARDSTORLEK = Number(SIZE['logo'] ?? 24);

export function Logotyp({ storlek = STANDARDSTORLEK }: { readonly storlek?: number }): ReactNode {
  const { farg } = useTema();
  const viewBox = LOGO_VIEWBOX.split(' ').map(Number);
  const bredd = viewBox[2] ?? 1000;
  const hojd = viewBox[3] ?? 927;

  return (
    <Svg
      width={storlek}
      height={(storlek * hojd) / bredd}
      viewBox={LOGO_VIEWBOX}
      accessibilityRole="image"
      accessibilityLabel="TechRabbit"
    >
      {LOGO_BANOR.map((bana, i) => (
        <Path
          key={i}
          d={bana.d}
          fillRule={bana.fillRule}
          fill={i === 0 ? farg['text'] : farg['greenIcon']}
        />
      ))}
    </Svg>
  );
}
