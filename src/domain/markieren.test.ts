import { describe, expect, it } from 'vitest';
import type { TextStueck } from './datumErkennen';
import { gehaltsMarken, monatStelle } from './markieren';
import { nameFinden, vollerNameFinden } from './nameFinden';

// PC64, Punkt 4 (W20): Monat und Name auf dem Gehaltsnachweis wie mit Textmarker.
const B = 0.01;
const stueck = (text: string, x: number, y: number): TextStueck => ({
  text,
  x,
  y,
  breite: text.length * B,
  hoehe: 0.015,
});
const SEITE = [
  stueck('Musterwerk GmbH', 0.1, 0.05),
  stueck('Verdienstabrechnung August 2026', 0.1, 0.08),
  stueck('Mitarbeiterin: Petra Mustermann', 0.1, 0.11),
  stueck('Auszahlung am 30.09.2026', 0.1, 0.9),
];

describe('Monat auf der Seite', () => {
  it('steht dort, wo „August 2026“ steht, nicht bei der Auszahlung', () => {
    const s = monatStelle(SEITE, '2026-08')!;
    expect(s.y).toBeCloseTo(0.08);
    expect(s.x).toBeCloseTo(0.1 + 'Verdienstabrechnung '.length * B);
    expect(s.breite).toBeCloseTo('August 2026'.length * B);
  });

  it('auch als Zahl, „08/2026“', () => {
    const s = monatStelle([stueck('Abrechnungsmonat 08/2026', 0.1, 0.2)], '2026-08')!;
    expect(s.x).toBeCloseTo(0.1 + 'Abrechnungsmonat '.length * B);
  });

  it('nach Hand gewählter Monat, der nicht auf der Seite steht: keine Markierung', () => {
    expect(monatStelle(SEITE, '2026-07')).toBeNull();
    // Die Auszahlung im September ist nicht der abgerechnete Monat.
    expect(monatStelle(SEITE, '2026-09')).toBeNull();
  });
});

describe('Name der Person', () => {
  it('der volle Name der Bürgin', () => {
    const s = vollerNameFinden(SEITE, 'Petra', 'Mustermann')!;
    expect(s.x).toBeCloseTo(0.1 + 'Mitarbeiterin: '.length * B);
    expect(s.breite).toBeCloseTo('Petra Mustermann'.length * B);
  });

  it('Gegenprobe: Max hat denselben Nachnamen, sein Name ist es aber nicht', () => {
    expect(vollerNameFinden(SEITE, 'Max', 'Mustermann')).toBeNull();
    // Die Suche nach dem Namen einer anderen Person (RU4) markiert dagegen schon den Nachnamen allein.
    expect(nameFinden(SEITE, 'Max', 'Mustermann')).not.toBeNull();
    // Ein Vorname, der nur Teil eines Worts ist, zählt nicht („Lea“ in „Leander“).
    expect(
      vollerNameFinden([stueck('Leander Mustermann', 0.1, 0.1)], 'Lea', 'Mustermann'),
    ).toBeNull();
  });

  it('„Nachname, Vorname“', () => {
    expect(
      vollerNameFinden([stueck('Mustermann, Petra', 0.1, 0.1)], 'Petra', 'Mustermann'),
    ).not.toBeNull();
  });
});

describe('Beides zusammen', () => {
  it('Monat und Name, für die Person, um die es geht', () => {
    expect(
      gehaltsMarken(SEITE, '2026-08', { vorname: 'Petra', nachname: 'Mustermann' }),
    ).toHaveLength(2);
    expect(
      gehaltsMarken(SEITE, '2026-08', { vorname: 'Lea', nachname: 'Mustermann' }),
    ).toHaveLength(1);
    expect(gehaltsMarken([], '2026-08', { vorname: 'Petra', nachname: 'Mustermann' })).toEqual([]);
  });
});
