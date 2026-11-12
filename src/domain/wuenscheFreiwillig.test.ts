import { describe, expect, it } from 'vitest';
import { urteile, wichtigsteAbweichungen, type Wohnung, type Wuensche } from './urteile';

// Jeder Wunsch ist freiwillig (Bildschirm „Was sucht ihr?“): Fehlt er, gibt es kein Urteil für dieses
// Kriterium, die übrigen bleiben, wie sie sind.

const wohnung: Wohnung = {
  warm: 1290,
  zimmer: 2,
  flaeche: 58,
  lage: null,
  einzug: '2027-04-01',
  tiere: null,
  befristung: null,
};
const geld = { netto: null, grenze: null, ihr: true };
const art = (wu: Wuensche, k: string) =>
  urteile(wohnung, wu, geld).find((u) => u.kriterium === k)?.art;

const leer: Wuensche = {
  warmBis: null,
  zimmerAb: null,
  flaecheAb: null,
  ort: null,
  einzugVon: null,
  einzugBis: null,
};

describe('Freiwillige Wünsche', () => {
  it('ohne Wünsche: kein Urteil bei Miete, Zimmer, Fläche, Lage, Einzug', () => {
    for (const k of ['Warmmiete', 'Zimmer', 'Fläche', 'Lage', 'Einzug'])
      expect(art(leer, k)).toBe('ohne');
    expect(wichtigsteAbweichungen(wohnung, leer, geld).alle).toBe(0);
  });

  it('nur die Miete gewünscht: nur sie hat ein Urteil', () => {
    const wu = { ...leer, warmBis: 1200 };
    expect(art(wu, 'Warmmiete')).toBe('nicht');
    expect(art(wu, 'Zimmer')).toBe('ohne');
    expect(wichtigsteAbweichungen(wohnung, wu, geld).alle).toBe(1);
  });

  it('Einzug mit nur einer Grenze', () => {
    expect(art({ ...leer, einzugBis: '2027-03-01' }, 'Einzug')).toBe('nicht');
    expect(art({ ...leer, einzugBis: '2027-05-01' }, 'Einzug')).toBe('passt');
    expect(art({ ...leer, einzugVon: '2027-04-20' }, 'Einzug')).toBe('knapp');
  });

  it('alle Wünsche: wie bisher', () => {
    const wu: Wuensche = {
      warmBis: 1200,
      zimmerAb: 3,
      flaecheAb: 60,
      ort: null,
      einzugVon: '2027-01-01',
      einzugBis: '2027-03-01',
    };
    expect(art(wu, 'Warmmiete')).toBe('nicht');
    expect(art(wu, 'Zimmer')).toBe('nicht');
    expect(art(wu, 'Fläche')).toBe('knapp');
    expect(art(wu, 'Einzug')).toBe('nicht');
  });
});
