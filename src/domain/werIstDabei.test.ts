import { describe, expect, it } from 'vitest';
import { mitEinSatz, personenZiehenEin, werIstDabeiKurz, werIstDabeiLang } from './mappeWoerter';

// Beispiele aus design/wer-ist-dabei.md (E25), Regel 5.
describe('Wer ist dabei: Kurzform', () => {
  it.each([
    [
      { vertrag: 2, kinder: 1, weitere: 0, buergen: 1 },
      'Zwei im Mietvertrag, ein Kind zieht mit ein. Eine Person bürgt.',
    ],
    [{ vertrag: 1, kinder: 0, weitere: 0, buergen: 0 }, 'Eine Person im Mietvertrag.'],
    [
      { vertrag: 3, kinder: 2, weitere: 1, buergen: 0 },
      'Drei im Mietvertrag, zwei Kinder und eine weitere Person ziehen mit ein.',
    ],
    [
      { vertrag: 2, kinder: 0, weitere: 0, buergen: 2 },
      'Zwei im Mietvertrag. Zwei Personen bürgen.',
    ],
    [
      { vertrag: 1, kinder: 0, weitere: 2, buergen: 0 },
      'Eine Person im Mietvertrag, zwei weitere Personen ziehen mit ein.',
    ],
  ])('%o', (w, satz) => {
    expect(werIstDabeiKurz(w)).toBe(satz);
  });

  it('nie eine Summe über die Gruppen', () => {
    expect(werIstDabeiKurz({ vertrag: 2, kinder: 1, weitere: 1, buergen: 1 })).not.toMatch(
      /vier|5|Personen ziehen ein/i,
    );
  });
});

describe('Wer ist dabei: Langform', () => {
  it('drei Gruppen in fester Reihenfolge, leere fallen weg', () => {
    expect(
      werIstDabeiLang({
        vertrag: ['Max Mustermann', 'Lea Mustermann'],
        kinder: 1,
        weitere: 0,
        buergen: ['Petra Mustermann'],
      }),
    ).toEqual([
      { titel: 'Im Mietvertrag', eintraege: ['Max Mustermann', 'Lea Mustermann'] },
      { titel: 'Ziehen mit ein', eintraege: ['Ein Kind'] },
      { titel: 'Bürgt', eintraege: ['Petra Mustermann'] },
    ]);
    expect(werIstDabeiLang({ vertrag: ['Max'], kinder: 0, weitere: 0, buergen: [] })).toEqual([
      { titel: 'Im Mietvertrag', eintraege: ['Max'] },
    ]);
  });

  it('E26: In der Selbstauskunft bleibt die Zahl, mit den Gruppen in Klammern, ohne Bürgen', () => {
    expect(personenZiehenEin({ vertrag: 2, kinder: 1, weitere: 0 })).toBe(
      'Drei Personen ziehen ein (zwei im Mietvertrag, ein Kind)',
    );
    expect(personenZiehenEin({ vertrag: 1, kinder: 2, weitere: 1 })).toBe(
      'Vier Personen ziehen ein (eine im Mietvertrag, zwei Kinder, eine weitere Person)',
    );
    expect(personenZiehenEin({ vertrag: 2, kinder: 0, weitere: 0 })).toBe(
      'Zwei Personen ziehen ein (zwei im Mietvertrag)',
    );
    expect(personenZiehenEin({ vertrag: 1, kinder: 0, weitere: 0 })).toBe('Eine Person zieht ein');
  });

  it('55: erste Zeile des Hinweises in der Übersicht, ohne Punkt', () => {
    expect(mitEinSatz(1, 0)).toBe('Ein Kind zieht mit ein');
    expect(mitEinSatz(1, 1)).toBe('Ein Kind und eine weitere Person ziehen mit ein');
    expect(mitEinSatz(3, 2)).toBe('Drei Kinder und zwei weitere Personen ziehen mit ein');
    expect(mitEinSatz(0, 2)).toBe('Zwei weitere Personen ziehen mit ein');
  });
});
