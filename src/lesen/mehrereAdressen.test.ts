import { describe, expect, it } from 'vitest';
import { adresseLesen, mehrereAdressen } from './leser';

// PC124 (N26, W10, Robustheitskatalog Regel 5): Nennt ein Inserat zwei Wohnungen mit eigener Adresse, übernimmt
// Hefta keine. Das Feld bleibt leer, und Hefta sagt, dass es mehrere gibt. Fall N26 aus dem Katalog PC117.
// Nur Musteradressen (W7).

const NL = String.fromCharCode(10);
const N26 = [
  'Freie Wohnungen',
  '',
  'Lindenring 3, 20259 Hamburg: 2 Zimmer, 650 € kalt',
  'Lindenring 8, 20259 Hamburg: 3 Zimmer, 890 € kalt',
].join(NL);

describe('mehrere Adressen in einem Inserat', () => {
  it('N26: zwei Wohnungen mit eigener Adresse: keine Adresse, aber „mehrere“', () => {
    expect(adresseLesen(N26)).toBeNull();
    expect(mehrereAdressen(N26)).toBe(true);
  });

  it('dieselbe Adresse zweimal, auch mit Geschoss, ist eine', () => {
    const zweimal = [
      'Lindenring 8, 20259 Hamburg',
      '',
      'Kaltmiete 650 €',
      'Lindenring 8, 2. OG, 20259 Hamburg',
    ].join(NL);
    expect(adresseLesen(zweimal)?.strasse).toBe('Lindenring 8');
    expect(mehrereAdressen(zweimal)).toBe(false);
  });

  it('Gegenprobe: eine Adresse wird gelesen, keine ist nicht „mehrere“', () => {
    expect(adresseLesen('Lindenring 3, 20259 Hamburg')?.strasse).toBe('Lindenring 3');
    expect(mehrereAdressen('Lindenring 3, 20259 Hamburg')).toBe(false);
    expect(mehrereAdressen('Wohnung in ruhiger Lage')).toBe(false);
  });
});
