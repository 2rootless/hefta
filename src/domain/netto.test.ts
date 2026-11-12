import { describe, expect, it } from 'vitest';
import { haushaltsNetto, nettoAusSelbstauskuenften } from './netto';

const m = (rolle: string, rufname: string, netto: number | null, farbe = 1) =>
  ({
    zugehoerigkeit: { rolle, farbe },
    person: { id: rufname, rufname, vorname: rufname, nettoeinkommen: netto },
  }) as never;

describe('Netto des Haushalts', () => {
  const alle = [
    m('haupt', 'Max', 2300, 1),
    m('mit', 'Lea', 1800, 2),
    m('buerge', 'Petra', 1500, 3),
  ];

  it('Summe aus den Selbstauskünften, ohne Bürgen', () => {
    const n = nettoAusSelbstauskuenften(alle);
    expect(n.summe).toBe(4100);
    expect(n.teile.map((t) => t.name)).toEqual(['Max', 'Lea']);
  });

  it('selbst eingetragen geht vor', () => {
    expect(haushaltsNetto({ netto: 4355 }, alle)).toBe(4355);
    expect(haushaltsNetto({ netto: null }, alle)).toBe(4100);
  });

  it('niemand hat etwas eingetragen: null', () => {
    expect(haushaltsNetto({}, [m('haupt', 'Max', null)])).toBeNull();
  });
});
