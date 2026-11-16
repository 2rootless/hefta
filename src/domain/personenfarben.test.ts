import { describe, expect, it } from 'vitest';
import dp40 from '../../design/dp40/DP40_an-planung_personenfarben-dunkel/tokens-personen-dunkel-DP40.json' with { type: 'json' };
import { PERSONENFARBEN } from './personenfarben';

// DP40, Prüfkatalog D1 und D2: Personenfarben auf dunklem Grund. Zeichen, Umriss, Ring und Linie stehen
// im Dunkeln in `dunkel`, nie im Druckton.

const DUNKLE_GRUENDE = ['#26221d', '#1b1814'];

function leuchtdichte(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const kanal = (wert: number) => {
    const c = wert / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal((n >> 16) & 255) + 0.7152 * kanal((n >> 8) & 255) + 0.0722 * kanal(n & 255);
}

function kontrast(a: string, b: string): number {
  const [hell, dunkel] = [leuchtdichte(a), leuchtdichte(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hell + 0.05) / (dunkel + 0.05);
}

/** Farben, deren Zeichen im Dunkeln unter 3 : 1 fallen. */
function zuSchwach(feld: 'dunkel' | 'druckton'): string[] {
  return PERSONENFARBEN.filter((f) =>
    DUNKLE_GRUENDE.some((grund) => kontrast(f[feld], grund) < 3),
  ).map((f) => f.name);
}

describe('Personenfarben im Dunkeln (DP40)', () => {
  it('D1: jede der zwölf Farben als Zeichen im Dunkeln mindestens 3 : 1 auf beiden Gründen', () => {
    expect(PERSONENFARBEN).toHaveLength(12);
    expect(zuSchwach('dunkel')).toEqual([]);
  });

  it('D1: die Tokens stimmen mit DP40 überein, `dunkel` ist heute wie `app`', () => {
    for (const f of PERSONENFARBEN) {
      const soll = dp40.farben.find((x) => x.nummer === f.nummer)!;
      expect(f.dunkel.toLowerCase()).toBe(soll.dunkel.toLowerCase());
      expect(f.dunkel.toLowerCase()).toBe(f.app.toLowerCase());
    }
  });

  it('D2, Gegenprobe: mit dem Druckton im Dunkeln wird D1 bei Lavendel, Petrol und Beere rot', () => {
    expect(zuSchwach('druckton')).toEqual(expect.arrayContaining(['Lavendel', 'Petrol', 'Beere']));
  });
});
