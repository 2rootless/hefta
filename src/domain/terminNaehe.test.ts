import { describe, expect, it } from 'vitest';
import { terminBand, terminNaehe, wochenAbstand } from './terminNaehe';

// Die 13 Fälle aus pruefkatalog-B25.md (heute Do, 12. Nov. 2026) und zwei der Planung (12w).
const DO = new Date(2026, 10, 12, 9, 0);
const SO = new Date(2026, 10, 15, 9, 0);
const am = (tag: number, monat = 10, jahr = 2026, stunde = 17, minute = 30) =>
  new Date(jahr, monat, tag, stunde, minute).toISOString();

describe('Nähe eines Termins (B25, E92)', () => {
  it('Reiter in den Fällen des Prüfkatalogs', () => {
    expect(terminNaehe(am(12), DO)).toEqual({ art: 'heute', wort: 'heute' });
    expect(terminNaehe(am(12, 10, 2026, 8), DO)).toEqual({
      art: 'vorbei',
      wort: 'vorbei',
      heute: true,
    });
    expect(terminNaehe(am(13), DO)).toEqual({ art: 'morgen', wort: 'morgen' });
    expect(terminNaehe(am(15), DO)).toEqual({ art: 'woche', wort: 'dieseWoche' });
    expect(terminNaehe(am(16), DO)).toEqual({ art: 'woche', wort: 'naechsteWoche' });
    expect(terminNaehe(am(17), DO)).toEqual({ art: 'woche', wort: 'naechsteWoche' });
    expect(terminNaehe(am(3, 11), DO)).toEqual({ art: 'spaeter', wort: 'inWochen', wochen: 3 });
    expect(terminNaehe(am(24, 11), DO)).toEqual({
      art: 'spaeter',
      wort: 'monat',
      monat: 11,
      jahr: null,
    });
    expect(terminNaehe(am(10), DO)).toMatchObject({ art: 'vorbei', heute: false });
    expect(terminNaehe(am(30, 9), DO)).toMatchObject({ art: 'vorbei', heute: false });
    expect(terminNaehe(am(16), SO)).toEqual({ art: 'morgen', wort: 'morgen' });
  });

  it('Planung 12w: Jahr erst ab mehr als elf Monaten; Sonntag auf Sonntag ist nächste Woche', () => {
    expect(terminNaehe(am(10, 9, 2027), DO)).toMatchObject({ wort: 'monat', jahr: null });
    expect(terminNaehe(am(10, 11, 2027), DO)).toMatchObject({ wort: 'monat', jahr: 2027 });
    expect(terminNaehe(am(22), SO)).toEqual({ art: 'woche', wort: 'naechsteWoche' });
    expect(wochenAbstand(new Date(2026, 10, 22), SO)).toBe(1);
  });

  it('Band: immer zwei Wochen, Lücke nur bei Abstand, genau ein Termintag und ein heute', () => {
    const tage = (b: ReturnType<typeof terminBand>) => b.wochen.map((w) => w.map((t) => t.tag));
    const nah = terminBand(am(17), DO);
    expect(tage(nah)).toEqual([
      [9, 10, 11, 12, 13, 14, 15],
      [16, 17, 18, 19, 20, 21, 22],
    ]);
    expect(nah.luecke).toBe(false);
    const drei = terminBand(am(3, 11), DO);
    expect(tage(drei)[1]).toEqual([30, 1, 2, 3, 4, 5, 6]);
    expect(drei.luecke).toBe(true);
    // Vorbei vor zwei Wochen: erst die Woche des Termins, dann diese.
    const vorbei = terminBand(am(30, 9), DO);
    expect(tage(vorbei)[0]).toEqual([26, 27, 28, 29, 30, 31, 1]);
    expect(vorbei.luecke).toBe(true);
    // Vorbei in der Woche davor: aneinander, ohne Lücke.
    expect(terminBand(am(5), DO).luecke).toBe(false);
    for (const b of [nah, drei, vorbei, terminBand(am(12), DO), terminBand(am(16), SO)]) {
      const alle = b.wochen.flat();
      expect(alle.filter((t) => t.termin)).toHaveLength(1);
      expect(alle.filter((t) => t.heute)).toHaveLength(1);
    }
    expect(nah.wochen[0][2]!.vorbei).toBe(true);
    expect(nah.wochen[0][5]!.wochenende).toBe(true);
  });
});
