import { describe, expect, it } from 'vitest';
import {
  abweichungsRang,
  befristungMonate,
  urteile,
  wichtigsteAbweichungen,
  type Haushaltsgeld,
  type Wohnung,
  type Wuensche,
} from './urteile';

// E76 (Planung 11r, 11s, 11t): Reihenfolge der Abweichungen in der Vorschau.

const WU: Wuensche = {
  warmBis: 1200,
  zimmerAb: 3,
  flaecheAb: 70,
  ort: { name: 'UKE', kmBis: 5 },
  einzugVon: '2027-01-01',
  einzugBis: '2027-03-01',
};
const GELD: Haushaltsgeld = { netto: 4100, grenze: null, ihr: true };
const PASST: Wohnung = {
  warm: 1100,
  zimmer: 3,
  flaeche: 80,
  lage: { km: 2, ungefaehr: false },
  einzug: '2027-02-01',
  tiere: 'erlaubt',
  befristung: 'unbefristet',
};
const reihe = (w: Wohnung, geld = GELD) =>
  wichtigsteAbweichungen(w, WU, geld, 10).zeilen.map((z) => z.text);

describe('Befristung in Monaten', () => {
  it('liest Jahre und Monate', () => {
    expect(befristungMonate('2 Jahre')).toBe(24);
    expect(befristungMonate('18 Monate')).toBe(18);
    expect(befristungMonate('1 Jahr und 6 Monate')).toBe(18);
    expect(befristungMonate('1,5 Jahre')).toBe(18);
    expect(befristungMonate('befristet')).toBe(0);
  });
});

describe('Reihenfolge (E76)', () => {
  it('nichts weicht ab: keine Zeilen', () => {
    expect(wichtigsteAbweichungen(PASST, WU, GELD)).toEqual({ zeilen: [], weitere: 0, alle: 0 });
  });

  it('„passt nicht“ vor „knapp“, auch wenn „knapp“ in Prozent weiter weg wäre', () => {
    // Fläche 66 statt 70: knapp (5,7 %); Warmmiete 1.300: passt nicht (8,3 %); Zimmer 2 statt 3: nicht (33 %).
    const w = { ...PASST, flaeche: 66, warm: 1300, zimmer: 2 };
    expect(wichtigsteAbweichungen(w, WU, GELD, 10).zeilen.map((z) => z.art)).toEqual([
      'nicht',
      'nicht',
      'knapp',
    ]);
    // Innerhalb von „passt nicht“: Zimmer (33 %) vor Warmmiete (8 %).
    expect(reihe(w)[0]).toMatch(/^2 Zimmer/);
    expect(reihe(w)[1]).toMatch(/warm/);
  });

  it('Ja-Nein-Punkte stehen oben in ihrer Gruppe; „keine Haustiere“ vor jeder Befristung', () => {
    const w: Wohnung = { ...PASST, zimmer: 1, tiere: 'nicht', befristung: '2 Jahre' };
    const r = reihe(w);
    expect(r[0]).toBe('keine Haustiere');
    expect(r[1]).toBe('befristet auf 2 Jahre');
    expect(r[2]).toMatch(/^1 Zimmer/);
  });

  it('Test der Planung (11s): 2 Jahre Befristung steht weiter oben als 3 Jahre', () => {
    const zwei = abweichungsRang({ ...PASST, befristung: '2 Jahre' }, WU, GELD)!;
    const drei = abweichungsRang({ ...PASST, befristung: '3 Jahre' }, WU, GELD)!;
    const vergleich = (a: number[], b: number[]) => a.findIndex((x, i) => x !== b[i]);
    const i = vergleich(zwei, drei);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(zwei[i]!).toBeLessThan(drei[i]!);
  });

  it('Einzug zählt in Monaten außerhalb des Zeitraums', () => {
    // Einzug 3 Monate nach dem spätesten Wunsch gegen Warmmiete 1 % darüber: beides „passt nicht“?
    const w: Wohnung = { ...PASST, einzug: '2027-06-01', warm: 1300 };
    // Warmmiete 8,3 % über, Einzug ≈ 3 Monate: 8,3 vor 3.
    expect(reihe(w)[0]).toMatch(/warm/);
    expect(reihe(w)[1]).toMatch(/^Einzug erst/);
  });

  it('Gleichstand: feste Reihenfolge der Kriterien', () => {
    // Zimmer und Fläche je 50 % darunter: Zimmer steht in urteile() vor Fläche.
    const w: Wohnung = { ...PASST, zimmer: 1.5, flaeche: 35 };
    expect(reihe(w)).toEqual([expect.stringMatching(/Zimmer/), expect.stringMatching(/m²/)]);
  });

  it('höchstens drei Zeilen, die Zahl der weiteren stimmt mit der Kontrolle überein (11t)', () => {
    const faelle: Wohnung[] = [
      PASST,
      { ...PASST, warm: 1230 },
      { ...PASST, warm: 1300, zimmer: 2, flaeche: 66 },
      { ...PASST, warm: 1300, zimmer: 2, flaeche: 66, tiere: 'nicht' },
      {
        ...PASST,
        warm: 1300,
        zimmer: 2,
        flaeche: 50,
        tiere: 'nicht',
        befristung: '1 Jahr',
        lage: { km: 9, ungefaehr: false },
      },
    ];
    for (const w of faelle) {
      const v = wichtigsteAbweichungen(w, WU, GELD);
      const kontrolle = urteile(w, WU, GELD).filter((u) => u.art === 'nicht' || u.art === 'knapp');
      expect(v.zeilen.length).toBeLessThanOrEqual(3);
      expect(v.zeilen.length + v.weitere).toBe(kontrolle.length);
    }
    expect(wichtigsteAbweichungen(faelle[4]!, WU, GELD).weitere).toBe(3);
  });

  it('offene Punkte zählen nicht', () => {
    const w: Wohnung = { ...PASST, tiere: 'anfrage', befristung: null, warm: 1300 };
    expect(wichtigsteAbweichungen(w, WU, GELD)).toMatchObject({ alle: 1, weitere: 0 });
  });
});
