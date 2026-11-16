import { describe, expect, it } from 'vitest';
import type { TextStueck } from './datumErkennen';
import { nameFinden } from './nameFinden';

const stueck = (text: string, x: number, y: number, breite = text.length * 0.01): TextStueck => ({
  text,
  x,
  y,
  breite,
  hoehe: 0.012,
});

describe('nameFinden (RU4, DP39 1.4)', () => {
  it('markiert Vor- und Nachname in einem Stück, nicht die Wörter davor', () => {
    const s = nameFinden([stueck('Mitarbeiterin: Lea Mustermann', 0.1, 0.2)], 'Lea', 'Mustermann');
    expect(s).not.toBeNull();
    // „Mitarbeiterin: “ sind 15 Zeichen zu je 0,01.
    expect(s!.x).toBeCloseTo(0.25, 5);
    expect(s!.breite).toBeCloseTo(0.14, 5);
    expect(s!.y).toBeCloseTo(0.2, 5);
  });

  it('fasst getrennte Stücke einer Zeile zusammen, auch „Nachname, Vorname“', () => {
    const s = nameFinden(
      [stueck('Mustermann,', 0.3, 0.5), stueck('Lea', 0.42, 0.5), stueck('Kunde', 0.1, 0.5)],
      'Lea',
      'Mustermann',
    );
    expect(s!.x).toBeCloseTo(0.3, 5);
    expect(s!.x + s!.breite).toBeCloseTo(0.45, 5);
  });

  it('markiert nur den Nachnamen, wenn der Vorname nicht daneben steht', () => {
    const s = nameFinden([stueck('Familie Mustermann', 0, 0.1)], 'Lea', 'Mustermann');
    expect(s!.x).toBeCloseTo(0.08, 5);
    expect(s!.breite).toBeCloseTo(0.1, 5);
  });

  it('findet nichts, wenn der Nachname fehlt oder leer ist', () => {
    expect(nameFinden([stueck('Max Mustermann', 0, 0)], 'Lea', 'Berg')).toBeNull();
    expect(nameFinden([stueck('Max Mustermann', 0, 0)], 'Lea', ' ')).toBeNull();
  });
});

describe('nameFinden mit gemessener Breite', () => {
  it('schmale Zeichen davor schieben die Markierung weniger weit', () => {
    // „il “ ist schmal, „Lea“ breit: gemessen beginnt der Name früher als bei gleich breiten Zeichen.
    const messen = (t: string) => [...t].reduce((s, z) => s + ('il '.includes(z) ? 1 : 3), 0);
    const s = nameFinden([stueck('il Lea Berg', 0, 0, 0.25)], 'Lea', 'Berg', messen);
    expect(s!.x).toBeCloseTo(0.03, 5);
    expect(s!.x + s!.breite).toBeCloseTo(0.25, 5);
  });
});
