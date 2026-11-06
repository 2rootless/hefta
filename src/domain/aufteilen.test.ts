import { describe, expect, it } from 'vitest';
import { dieselbeDatei, monateVorbelegen, seitenJeMonat, serienQuellen } from './aufteilen';
import type { DateiVersion } from './modell';

const v = (id: string, original: string, seiten: number[] | null = null) =>
  ({ id, original, aufbereitet: null, seiten }) as DateiVersion;

describe('dieselbe Datei in mehreren Versionen (P20)', () => {
  it('findet sie, solange sich Seiten überschneiden', () => {
    expect(dieselbeDatei([v('a', 'x'), v('b', 'x'), v('c', 'y')]).map((g) => g.id)).toEqual([
      'a',
      'b',
    ]);
    expect(dieselbeDatei([v('a', 'x', [0]), v('b', 'x', [0, 1])])).toHaveLength(2);
  });
  it('schweigt, wenn jede Version ihre eigene Seite hat', () => {
    expect(dieselbeDatei([v('a', 'x', [0]), v('b', 'x', [1])])).toEqual([]);
    expect(dieselbeDatei([v('a', 'x'), v('b', 'y')])).toEqual([]);
  });
});

describe('Monate vorbelegen', () => {
  it('nimmt den Monat von der Seite, Folgeseiten gehören zur Seite davor', () => {
    expect(monateVorbelegen(['2026-07', null, '2026-08'], [])).toEqual([
      '2026-07',
      '2026-07',
      '2026-08',
    ]);
    expect(monateVorbelegen([null, '2026-08'], [])).toEqual(['2026-08', '2026-08']);
  });
  it('ohne Fund der Reihe nach, älteste zuerst', () => {
    expect(monateVorbelegen([null, null], ['2026-09', '2026-07', '2026-08'])).toEqual([
      '2026-07',
      '2026-08',
    ]);
  });
  it('gruppiert die Seiten, „Nicht in die Mappe“ fällt weg', () => {
    expect(seitenJeMonat(['2026-07', '', '2026-07', '2026-08'])).toEqual([
      { monat: '2026-07', seiten: [0, 2] },
      { monat: '2026-08', seiten: [3] },
    ]);
  });
});

describe('Serie in der Mappe', () => {
  const m = (monat: string, original: string, seiten: number[] | null = null) =>
    ({ ...v(monat, original, seiten), abrechnungsmonat: monat }) as DateiVersion;

  it('aufgeteilte Monate behalten je ihre eigene Seite, keine geht verloren', () => {
    expect(
      serienQuellen([m('2026-07', 'x', [0]), m('2026-08', 'x', [1]), m('2026-09', 'x', [2])]),
    ).toEqual([
      { id: 'x', monate: ['2026-07'], seiten: [0] },
      { id: 'x', monate: ['2026-08'], seiten: [1] },
      { id: 'x', monate: ['2026-09'], seiten: [2] },
    ]);
  });

  it('dieselbe Datei ohne Aufteilung kommt einmal, mit allen Monaten', () => {
    expect(serienQuellen([m('2026-07', 'x'), m('2026-08', 'x'), m('2026-09', 'y')])).toEqual([
      { id: 'x', monate: ['2026-07', '2026-08'], seiten: null },
      { id: 'y', monate: ['2026-09'], seiten: null },
    ]);
  });
});
