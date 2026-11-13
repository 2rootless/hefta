import { describe, expect, it } from 'vitest';
import { namenListe, spurAn, spurEintragen } from './datenspur';

describe('Datenspur', () => {
  it('Empfänger: Name aus dem Inserat, sonst Adresse, beim Portal das Portal', () => {
    const o = { mail: 'kraus@example.org', portal: 'ImmoScout24' };
    expect(spurAn({ ...o, anbieter: 'Herr Kraus', weg: 'mail' })).toBe('Herrn Kraus');
    expect(spurAn({ ...o, anbieter: 'Frau Dr. Peters', weg: 'mail' })).toBe('Frau Dr. Peters');
    expect(spurAn({ ...o, anbieter: 'Hausverwaltung Nord', weg: 'mail' })).toBe(
      'Hausverwaltung Nord',
    );
    expect(spurAn({ ...o, anbieter: null, weg: 'mail' })).toBe('kraus@example.org');
    expect(spurAn({ ...o, anbieter: 'Herr Kraus', weg: 'portal' })).toBe('ImmoScout24');
    expect(spurAn({ anbieter: null, mail: null, portal: null, weg: 'website' })).toBe('');
  });

  it('Fassung zählt nur die Mappen an diese Wohnung', () => {
    const eins = spurEintragen(undefined, { am: 'a', art: 'mappe', weg: 'mail', an: '' });
    const zwei = spurEintragen(eins, { am: 'b', art: 'nachfrage', weg: 'mail', an: '' });
    const drei = spurEintragen(zwei, { am: 'c', art: 'mappe', weg: 'portal', an: '' });
    expect(drei.map((e) => e.fassung)).toEqual([1, undefined, 2]);
  });

  it('Namen als Liste', () => {
    expect(namenListe(['Max'])).toBe('Max');
    expect(namenListe(['Max', 'Lea', 'Paul'])).toBe('Max, Lea und Paul');
  });
});
