import { describe, expect, it } from 'vitest';
import { deckZeilen } from './deckZeilen';

const HEUTE = new Date(2026, 10, 13);

describe('Zeilen fürs Deckblatt (B14, E39)', () => {
  it('alle drei, Fassung zählt die Mappen der Datenspur', () => {
    expect(
      deckZeilen(
        {
          angaben: { portal: 'ImmoScout24' } as never,
          quelle: '',
          einzug: '2027-02-01',
          spur: [{ am: '', art: 'mappe', weg: 'mail', an: '' }],
        },
        HEUTE,
      ),
    ).toEqual({
      deckInserat: 'Zu Ihrem Inserat auf ImmoScout24',
      deckEinzug: 'Einzug möglich ab 1. Februar 2027',
      deckFassung: 'Fassung 2 vom 13. November 2026',
    });
  });

  it('ohne Portal und Einzug nur die Fassung', () => {
    expect(deckZeilen({ angaben: undefined, quelle: '', einzug: undefined }, HEUTE)).toEqual({
      deckFassung: 'Fassung 1 vom 13. November 2026',
    });
  });
});
