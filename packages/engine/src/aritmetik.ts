/**
 * Aritmetik med egen tolk. Ingen `eval`, ingen `new Function`.
 *
 * AI:n skriver bara om frågan från ord till tecken ("tjugo plus fem procent av
 * hundra" → "20 + 5 % av 100" blir inte den här funktionens jobb; den får
 * "20 + 5"). Räkningen sker här, så att varje tal går att följa.
 *
 * Grammatik, enklast möjliga med rätt prioritet:
 *
 *   uttryck  → term (('+' | '−') term)*
 *   term     → faktor (('×' | '÷') faktor)*
 *   faktor   → ('−' | '+') faktor | tal | '(' uttryck ')'
 *
 * Svensk talskrivning gäller: komma som decimaltecken, mellanslag som
 * tusenavskiljare. Både "×" och "*", både "÷", "/" och ":" tas emot, liksom
 * både "−" (minustecken) och "-" (bindestreck).
 */

import { formatTal } from './format.ts';
import { RaknefelError, type Resultat, type Steg } from './typer.ts';

/** Fler steg än så blir obegripligt att läsa. Då visas bara uttryck och svar. */
const MAX_STEG = 12;

type Tecken =
  | { readonly slag: 'tal'; readonly varde: number; readonly text: string }
  | { readonly slag: 'operator'; readonly tecken: '+' | '−' | '×' | '÷' }
  | { readonly slag: 'vanster' }
  | { readonly slag: 'hoger' };

function felaktigt(meddelande: string): never {
  throw new RaknefelError('ogiltigt-uttryck', meddelande);
}

/** Normaliserar skrivsätt så tolken bara behöver känna fyra operatorer. */
function normalisera(text: string): string {
  return text
    .replace(/[-−–—]/g, '−') // bindestreck, minustecken, tankstreck
    .replace(/[*·]/g, '×')
    .replace(/[/:]/g, '÷')
    .replace(/[[{]/g, '(')
    .replace(/[\]}]/g, ')')
    .replace(/[  ]/g, ' ');
}

function tecknaUpp(uttryck: string): readonly Tecken[] {
  const text = normalisera(uttryck);
  const ut: Tecken[] = [];
  let i = 0;

  while (i < text.length) {
    const c = text[i]!;

    if (c === ' ') {
      i += 1;
      continue;
    }

    if (c === '(') {
      ut.push({ slag: 'vanster' });
      i += 1;
      continue;
    }
    if (c === ')') {
      ut.push({ slag: 'hoger' });
      i += 1;
      continue;
    }
    if (c === '+' || c === '−' || c === '×' || c === '÷') {
      ut.push({ slag: 'operator', tecken: c });
      i += 1;
      continue;
    }

    if (/[0-9]/.test(c)) {
      // Ett tal: siffror, mellanslag som tusenavskiljare, komma eller punkt.
      let rad = '';
      while (i < text.length) {
        const d = text[i]!;
        if (/[0-9]/.test(d)) {
          rad += d;
          i += 1;
        } else if ((d === ',' || d === '.') && /[0-9]/.test(text[i + 1] ?? '')) {
          rad += '.';
          i += 1;
        } else if (d === ' ' && /^[0-9]{3}(?![0-9])/.test(text.slice(i + 1))) {
          // Mellanslag räknas som tusenavskiljare bara före exakt tre siffror.
          i += 1;
        } else {
          break;
        }
      }
      const varde = Number(rad);
      if (!Number.isFinite(varde)) felaktigt(`"${rad}" är inget tal jag kan läsa.`);
      ut.push({ slag: 'tal', varde, text: rad });
      continue;
    }

    felaktigt(`Tecknet "${c}" hör inte i ett räkneuttryck.`);
  }

  if (ut.length === 0) felaktigt('Uttrycket är tomt.');
  return ut;
}

/**
 * Tolken. Varje binär räkning blir ett steg, i den ordning den utförs, så
 * "Så räknade jag" visar prioriteten i stället för att påstå den.
 */
class Tolk {
  private pos = 0;
  readonly steg: Steg[] = [];
  // Egen rad i stallet for parameteregenskap: Nodes typavskalning kor
  // strip-only och stodjer inte `constructor(private x)`.
  private readonly tecken: readonly Tecken[];

  constructor(tecken: readonly Tecken[]) {
    this.tecken = tecken;
  }

  private kika(): Tecken | undefined {
    return this.tecken[this.pos];
  }

  private rakna(a: number, op: '+' | '−' | '×' | '÷', b: number): number {
    if (op === '÷' && b === 0) {
      throw new RaknefelError('division-med-noll', 'Det går inte att dela med noll.');
    }
    const svar = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
    this.steg.push({
      nr: this.steg.length + 1,
      etikett: 'Räknat',
      uttryck: `${formatTal(a)} ${op} ${formatTal(b)}`,
      resultat: formatTal(svar),
    });
    return svar;
  }

  uttryck(): number {
    let varde = this.term();
    for (;;) {
      const t = this.kika();
      if (t?.slag !== 'operator' || (t.tecken !== '+' && t.tecken !== '−')) break;
      this.pos += 1;
      varde = this.rakna(varde, t.tecken, this.term());
    }
    return varde;
  }

  private term(): number {
    let varde = this.faktor();
    for (;;) {
      const t = this.kika();
      if (t?.slag !== 'operator' || (t.tecken !== '×' && t.tecken !== '÷')) break;
      this.pos += 1;
      varde = this.rakna(varde, t.tecken, this.faktor());
    }
    return varde;
  }

  private faktor(): number {
    const t = this.kika();
    if (t === undefined) felaktigt('Uttrycket slutar mitt i en räkning.');

    if (t.slag === 'operator' && (t.tecken === '−' || t.tecken === '+')) {
      this.pos += 1;
      const varde = this.faktor();
      return t.tecken === '−' ? -varde : varde;
    }
    if (t.slag === 'tal') {
      this.pos += 1;
      return t.varde;
    }
    if (t.slag === 'vanster') {
      this.pos += 1;
      const varde = this.uttryck();
      if (this.kika()?.slag !== 'hoger') felaktigt('En parentes är inte stängd.');
      this.pos += 1;
      return varde;
    }
    felaktigt('Det står en operator eller parentes där ett tal skulle stå.');
  }

  klar(): boolean {
    return this.pos === this.tecken.length;
  }
}

/**
 * Räknar ut ett uttryck.
 *
 * arithmetic('12 + 3 × 4')        → 24
 * arithmetic('(12 + 3) × 4')      → 60
 * arithmetic('1 200 ÷ 3', 'kr')   → 400 kr
 *
 * @param uttryck  uttrycket med tecken, inte ord
 * @param unit     enhet att visa efter svaret, t.ex. "kr". Utan värde: ingen.
 * @param etikett  vad talet betyder, ur frågans egna ord. Utan värde: "Svar".
 */
export function arithmetic(uttryck: string, unit = '', etikett?: string): Resultat {
  if (typeof uttryck !== 'string' || uttryck.trim() === '') {
    felaktigt('Det finns inget uttryck att räkna på.');
  }

  const tolk = new Tolk(tecknaUpp(uttryck));
  const varde = tolk.uttryck();
  if (!tolk.klar()) felaktigt('Det står något kvar efter uttrycket.');
  if (!Number.isFinite(varde)) {
    throw new RaknefelError('ogiltigt-tal', 'Uttrycket ger inget tal jag kan visa.');
  }

  const normaliserat = normalisera(uttryck).replace(/\s+/g, ' ').trim();
  const steps: readonly Steg[] =
    tolk.steg.length === 0 || tolk.steg.length > MAX_STEG
      ? [
          {
            nr: 1,
            etikett: 'Räknat',
            uttryck: normaliserat,
            resultat: formatTal(varde),
          },
        ]
      : tolk.steg;

  // Direktiv 36: har frågan sagt vad talet är står det över svaret i stället
  // för ordet "Svar". Ren aritmetik är det enda räknesätt som inte kan hämta
  // sin betydelse ur sig självt — ett uttryck in, ett tal ut.
  const betydelse = typeof etikett === 'string' && etikett.trim() !== '' ? etikett.trim() : 'Svar';
  return { value: varde, unit, steps, formatted: formatTal(varde), betydelse };
}
