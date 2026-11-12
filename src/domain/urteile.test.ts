import { describe, expect, it } from 'vitest';
import {
  abweichungen,
  kmText,
  monatVorher,
  urteile,
  type Haushaltsgeld,
  type Wohnung,
  type Wuensche,
} from './urteile';

const NB = ' ';
// Die Wünsche der Muster aus B16 (build_b16.py, WU) und das Netto der Familie.
const WU: Wuensche = {
  warmBis: 1200,
  zimmerAb: 2.5,
  flaecheAb: 60,
  ort: { name: 'UKE', kmBis: 5 },
  einzugVon: '2027-01-01',
  einzugBis: '2027-03-01',
};
const GELD: Haushaltsgeld = { netto: 4100, grenze: null, ihr: true };
const LINDEN: Wohnung = {
  warm: 1240,
  zimmer: 3,
  flaeche: 74,
  lage: { km: 2.4, ungefaehr: false },
  einzug: '2027-01-01',
  tiere: 'erlaubt',
  befristung: 'unbefristet',
};
const art = (w: Wohnung, k: string, geld = GELD) =>
  urteile(w, WU, geld).find((u) => u.kriterium === k)!.art;

describe('Urteile (B16, Nachricht 9.11. b und c, E50)', () => {
  it('Lindenallee: Warmmiete knapp, sonst passt alles', () => {
    expect(abweichungen(urteile(LINDEN, WU, GELD))).toEqual([
      { art: 'knapp', wort: 'knapp', text: `1.240${NB}€ warm, 40${NB}€ über 1.200${NB}€` },
      { art: 'sonst', wort: '', text: 'Sonst passt alles.' },
    ]);
  });

  it('Schwellen: Warmmiete bis 5 %, Fläche bis 10 % darunter, Lage bis 10 % weiter', () => {
    expect(art({ ...LINDEN, warm: 1260 }, 'Warmmiete')).toBe('knapp');
    expect(art({ ...LINDEN, warm: 1261 }, 'Warmmiete')).toBe('nicht');
    expect(art({ ...LINDEN, flaeche: 54 }, 'Fläche')).toBe('knapp');
    expect(art({ ...LINDEN, flaeche: 53 }, 'Fläche')).toBe('nicht');
    expect(art({ ...LINDEN, lage: { km: 5.5, ungefaehr: false } }, 'Lage')).toBe('knapp');
    expect(art({ ...LINDEN, lage: { km: 5.6, ungefaehr: false } }, 'Lage')).toBe('nicht');
  });

  it('ungefähre Lage: ganze Kilometer, Spanne je Postleitzahl, beide Spannen bei ungefährem Ort', () => {
    expect(kmText(4.7, true)).toBe(`ca.${NB}5${NB}km`);
    expect(kmText(2.4, false)).toBe(`2,4${NB}km`);
    const ungefaehr = { ...LINDEN, lage: { km: 4.7, ungefaehr: true, spanne: 1 } };
    expect(abweichungen(urteile(ungefaehr, WU, GELD))[0]).toEqual({
      art: 'knapp',
      wort: 'knapp',
      text: `1.240${NB}€ warm, 40${NB}€ über 1.200${NB}€`,
    });
    expect(urteile(ungefaehr, WU, GELD).find((u) => u.kriterium === 'Lage')).toEqual({
      kriterium: 'Lage',
      art: 'knapp',
      wert: `ca.${NB}5${NB}km`,
      abweichung: `UKE ca.${NB}5${NB}km entfernt, bis 5${NB}km gewünscht`,
    });
    expect(art({ ...LINDEN, lage: { km: 3.9, ungefaehr: true, spanne: 1 } }, 'Lage')).toBe('passt');
    expect(art({ ...LINDEN, lage: { km: 6.1, ungefaehr: true, spanne: 1 } }, 'Lage')).toBe('nicht');
    // Große Postleitzahl auf dem Land: Spanne 3 km.
    expect(art({ ...LINDEN, lage: { km: 7.5, ungefaehr: true, spanne: 3 } }, 'Lage')).toBe('knapp');
    // Auch der eigene Ort aus der Postleitzahl: beide Spannen zählen.
    const ortUngefaehr = { ...WU, ort: { name: 'UKE', kmBis: 5, ungefaehr: true, spanne: 1 } };
    const zwei = urteile(
      { ...LINDEN, lage: { km: 6.8, ungefaehr: true, spanne: 1 } },
      ortUngefaehr,
      GELD,
    );
    expect(zwei.find((u) => u.kriterium === 'Lage')!.art).toBe('knapp');
  });

  it('Einzug: knapp bis einen Monat vor dem Wunsch, früher oder später passt nicht', () => {
    expect(monatVorher('2027-01-01')).toBe('2026-12-01');
    expect(monatVorher('2027-03-31')).toBe('2027-02-28');
    expect(art({ ...LINDEN, einzug: '2026-12-01' }, 'Einzug')).toBe('knapp');
    const frueh = urteile({ ...LINDEN, einzug: '2026-11-30' }, WU, GELD).find(
      (u) => u.kriterium === 'Einzug',
    )!;
    expect(frueh).toMatchObject({
      art: 'nicht',
      abweichung: `Einzug schon am 30.${NB}Nov., mehr als einen Monat vor dem Wunsch`,
    });
    const spaet = urteile({ ...LINDEN, einzug: '2027-03-02' }, WU, GELD).find(
      (u) => u.kriterium === 'Einzug',
    )!;
    expect(spaet.abweichung).toBe(`Einzug erst am 2.${NB}März, nach dem spätesten Wunschtermin`);
  });

  it('Anteil am Einkommen: ohne Haushalt leer, ohne Grenze ohne Urteil, mit Grenze wie jedes Kriterium', () => {
    expect(art(LINDEN, 'Anteil am Einkommen', { netto: null, grenze: null, ihr: true })).toBe(
      'leer',
    );
    expect(art(LINDEN, 'Anteil am Einkommen')).toBe('ohne');
    const mitGrenze = urteile(LINDEN, WU, { netto: 4100, grenze: 25, ihr: true });
    const zeilen = abweichungen(mitGrenze);
    expect(zeilen).toContainEqual({
      art: 'nicht',
      wort: 'passt nicht',
      text: `Anteil am Einkommen 30${NB}%, eure Grenze 25${NB}%`,
      schloss: true,
    });
    expect(art(LINDEN, 'Anteil am Einkommen', { netto: 4100, grenze: 28, ihr: false })).toBe(
      'knapp',
    );
  });
});

describe('Abweichungen (W12 bis W15)', () => {
  const OFFEN: Wohnung = {
    warm: null,
    zimmer: null,
    flaeche: null,
    lage: null,
    einzug: null,
    tiere: null,
    befristung: null,
  };

  it('alles offen: keine Zeile „Sonst passt alles.“ (W12)', () => {
    const z = abweichungen(urteile(OFFEN, WU, GELD));
    expect(z).toEqual([
      {
        art: 'offen',
        wort: 'offen',
        text: 'Warmmiete, Zimmer, Fläche, Lage, Einzug, Haustiere, Befristung',
      },
    ]);
  });

  it('wenig passt und etwas ist offen: „passt: Lage“ (Nachricht 9.11. c)', () => {
    const z = abweichungen(urteile({ ...OFFEN, lage: { km: 2.4, ungefaehr: false } }, WU, GELD));
    expect(z[z.length - 1]).toEqual({ art: 'passt', wort: 'passt', text: 'Lage' });
  });

  it('alles passt: „Alles passt.“', () => {
    expect(abweichungen(urteile({ ...LINDEN, warm: 1100 }, WU, GELD))).toEqual([
      { art: 'alles', wort: '', text: 'Alles passt.' },
    ]);
  });

  it('Warmmiete nur geschätzt: offen mit Heizkosten', () => {
    const u = urteile({ ...LINDEN, warm: null, warmCa: 1180 }, WU, GELD);
    expect(u[0]).toEqual({
      kriterium: 'Warmmiete',
      art: 'offen',
      wert: `ca.${NB}1.180${NB}€`,
      abweichung: 'Heizkosten',
    });
  });
});
