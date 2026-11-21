import { describe, expect, it } from 'vitest';
import { zusageNamen, zusageTag, zusageWofuer } from './zusage';

// DP109: die Zusage im Heft. Namen aus der Namensliste (W40).
const ihr = (n: number) => `ihr ${['null', 'eins', 'zwei', 'drei', 'vier', 'fünf'][n] ?? n}`;
const HEUTE = new Date(2026, 10, 21, 15, 0);

describe('DP109: Zusage', () => {
  it('nennt bis drei Rufnamen, ab vier „ihr vier“', () => {
    expect(zusageNamen(['Selin'], ihr)).toBe('Selin');
    expect(zusageNamen(['Selin', 'Jarne'], ihr)).toBe('Selin und Jarne');
    expect(zusageNamen(['Mai Linh', 'Konstantin', 'Johanna'], ihr)).toBe(
      'Mai Linh, Konstantin und Johanna',
    );
    expect(zusageNamen(['A', 'B', 'C', 'D'], ihr)).toBe('ihr vier');
    expect(zusageNamen([], ihr)).toBe('');
  });

  it('nimmt den Tag nur aus „Zusage am“: heute, gestern, Tag mit Monat, im Vorjahr mit Jahr', () => {
    expect(zusageTag(new Date(2026, 10, 21, 9).toISOString(), HEUTE)).toEqual({ art: 'heute' });
    expect(zusageTag(new Date(2026, 10, 20, 23).toISOString(), HEUTE)).toEqual({ art: 'gestern' });
    expect(zusageTag(new Date(2026, 10, 12, 10).toISOString(), HEUTE)).toEqual({
      art: 'am',
      text: '12. November',
    });
    expect(zusageTag(new Date(2025, 11, 30, 10).toISOString(), HEUTE)).toEqual({
      art: 'am',
      text: '30. Dezember 2025',
    });
  });

  it('W10 Gegenprobe: ohne Eintrag kein Tag, auch nicht aus einem anderen Datum', () => {
    expect(zusageTag(undefined, HEUTE)).toEqual({ art: 'ohne' });
    expect(zusageTag(null, HEUTE)).toEqual({ art: 'ohne' });
    expect(zusageTag('kein Datum', HEUTE)).toEqual({ art: 'ohne' });
  });

  it('nennt die Straße, sonst den eigenen Namen des Hefts, sonst nichts', () => {
    expect(zusageWofuer('Lindenring 3', 'Altbau mit Garten')).toEqual({
      art: 'strasse',
      text: 'Lindenring 3',
    });
    expect(zusageWofuer('', 'Altbau mit Garten')).toEqual({
      art: 'name',
      text: 'Altbau mit Garten',
    });
    expect(zusageWofuer(' ', '')).toBeNull();
  });
});
