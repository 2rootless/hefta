import { describe, expect, it } from 'vitest';
import { mitGeistern, wechselVon, type Blick, type ZeilenArt } from './mappeBlick';

function blick(
  teil: Partial<Omit<Blick<string, string>, 'zeilen'>> & { zeilen?: [string, ZeilenArt][] },
) {
  return {
    personen: [{ id: 'max', daten: 'Max' }],
    aufgaben: [],
    offen: 0,
    startklar: false,
    satz: '',
    ...teil,
    zeilen: new Map(teil.zeilen ?? []),
  } as Blick<string, string>;
}

describe('Tab „Mappe“: was seit dem letzten Blick geschah (B21)', () => {
  it('ohne letzten Blick bewegt sich nichts', () => {
    const w = wechselVon(null, blick({ zeilen: [['max/gehalt', 'da']] }));
    expect(w.nr).toBe(0);
    expect(w.kam.size).toBe(0);
  });

  it('eine Unterlage kommt an: Zeile, Aufgabe weg, Zahl und Satz', () => {
    const vorher = blick({
      zeilen: [['max/gehalt', 'fehlt']],
      aufgaben: [{ schluessel: 'max/gehalt', daten: 'Gehalt' }],
      offen: 2,
      satz: 'Noch zwei Dinge',
    });
    const jetzt = blick({ zeilen: [['max/gehalt', 'da']], offen: 1, satz: 'Noch ein Ding' });
    const w = wechselVon(vorher, jetzt);
    expect([...w.kam]).toEqual(['max/gehalt']);
    expect(w.wegAufgaben).toEqual([{ schluessel: 'max/gehalt', daten: 'Gehalt', platz: 0 }]);
    expect(w.zahl && w.satz).toBe(true);
    expect(w.startklar).toBe(false);
    expect(w.nr).toBeGreaterThan(0);
  });

  it('„Alles da“ nur ohne offenen Prüfhinweis; ein neuer Prüfhinweis ist eigene Stelle', () => {
    const vorher = blick({ zeilen: [['max/gehalt', 'fehlt']], offen: 1 });
    expect(
      wechselVon(vorher, blick({ zeilen: [['max/gehalt', 'da']], startklar: true })).startklar,
    ).toBe(true);
    const w = wechselVon(vorher, blick({ zeilen: [['max/gehalt', 'pruef']], startklar: false }));
    expect(w.startklar).toBe(false);
    expect([...w.pruef]).toEqual(['max/gehalt']);
    expect(w.kam.size).toBe(0);
  });

  it('mehr als drei Zeilen: nur Zahl und Satz bewegen sich', () => {
    const typen = ['a', 'b', 'c', 'd'];
    const vorher = blick({ zeilen: typen.map((t) => [`max/${t}`, 'fehlt']), offen: 4 });
    const w = wechselVon(vorher, blick({ zeilen: typen.map((t) => [`max/${t}`, 'da']), offen: 0 }));
    expect(w.kam.size).toBe(0);
    expect(w.zahl).toBe(true);
  });

  it('Person kommt und geht; neue Zeilen einer neuen Person sind keine Ankunft', () => {
    const vorher = blick({
      personen: [
        { id: 'max', daten: 'Max' },
        { id: 'petra', daten: 'Petra' },
      ],
    });
    const jetzt = blick({
      personen: [
        { id: 'max', daten: 'Max' },
        { id: 'lea', daten: 'Lea' },
      ],
      zeilen: [['lea/gehalt', 'da']],
    });
    const w = wechselVon(vorher, jetzt);
    expect([...w.neuePersonen]).toEqual(['lea']);
    expect(w.wegPersonen).toEqual([{ id: 'petra', daten: 'Petra', platz: 1 }]);
    expect(w.kam.size).toBe(0);
  });

  it('was geht, steht an seinem alten Platz', () => {
    expect(
      mitGeistern(
        ['max', 'lea'],
        [
          { platz: 1, daten: 'petra' },
          { platz: 5, daten: 'ali' },
        ],
      ),
    ).toEqual([
      { wert: 'max', geist: false },
      { wert: 'petra', geist: true },
      { wert: 'lea', geist: false },
      { wert: 'ali', geist: true },
    ]);
  });
});
