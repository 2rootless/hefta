import { describe, expect, it } from 'vitest';
import { gruss, grussNamen, grussWort } from './gruss';

const um = (stunde: number, minute = 0) => new Date(2026, 10, 10, stunde, minute);

describe('Gruß nach Tageszeit (E50)', () => {
  it('folgt der Tabelle aus Bericht 61, Abschnitt 1.3, an den Grenzen', () => {
    expect(grussWort(4)).toBe('Hallo');
    expect(grussWort(5)).toBe('Guten Morgen');
    expect(grussWort(10)).toBe('Guten Morgen');
    expect(grussWort(11)).toBe('Hallo');
    expect(grussWort(17)).toBe('Hallo');
    expect(grussWort(18)).toBe('Guten Abend');
    expect(grussWort(21)).toBe('Guten Abend');
    expect(grussWort(22)).toBe('Hallo');
    expect(grussWort(0)).toBe('Hallo');
  });

  it('wie in B12 gezeichnet: 8, 14, 19 und 23 Uhr', () => {
    const namen = ['Max', 'Lea'];
    expect(gruss(um(8), namen)).toBe('Guten Morgen, Max und Lea');
    expect(gruss(um(14), namen)).toBe('Hallo, Max und Lea');
    expect(gruss(um(19), namen)).toBe('Guten Abend, Max und Lea');
    expect(gruss(um(23), namen)).toBe('Hallo, Max und Lea');
    expect(gruss(um(10, 59), namen)).toBe('Guten Morgen, Max und Lea');
  });
});

describe('Namen im Gruß', () => {
  it('einer, zwei, drei', () => {
    expect(grussNamen(['Lea'])).toBe('Lea');
    expect(grussNamen(['Max', 'Lea'])).toBe('Max und Lea');
    expect(grussNamen(['Max', 'Lea', 'Tom'])).toBe('Max, Lea und Tom');
  });

  it('ab vier „ihr vier“', () => {
    expect(grussNamen(['A', 'B', 'C', 'D'])).toBe('ihr vier');
    expect(grussNamen(['A', 'B', 'C', 'D', 'E'])).toBe('ihr fünf');
    expect(gruss(um(19), ['A', 'B', 'C', 'D'])).toBe('Guten Abend, ihr vier');
  });

  it('ohne Haushalt oder ohne Namen: nur das Grußwort, ohne Komma (B15)', () => {
    expect(gruss(um(8), [])).toBe('Guten Morgen');
    expect(gruss(um(14), [' '])).toBe('Hallo');
  });
});
