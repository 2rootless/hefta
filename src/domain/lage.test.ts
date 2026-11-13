import { describe, expect, it } from 'vitest';
import tabelleDatei from '../../data/plz.de.json';
import { lageAus, luftlinieKm, plzAus, type PlzTabelle } from './lage';

const TABELLE = tabelleDatei.plz as unknown as PlzTabelle;

describe('Lage nach Postleitzahl (E46, E50)', () => {
  it('liest die Postleitzahl aus der Adresse', () => {
    expect(plzAus('Lindenallee 3, EG\n20259 Hamburg')).toBe('20259');
    expect(plzAus('Am Markt 4, 01067 Dresden')).toBe('01067');
    expect(plzAus('Hauptstraße 12345')).toBeNull();
    expect(plzAus('')).toBeNull();
  });

  it('Luftlinie: Hamburg–Berlin etwa 255 km', () => {
    expect(luftlinieKm([53.55, 10.0], [52.52, 13.405])).toBeGreaterThan(250);
    expect(luftlinieKm([53.55, 10.0], [52.52, 13.405])).toBeLessThan(260);
  });

  it('aus der Tabelle: Eimsbüttel zum UKE ein paar Kilometer, ungefähr, mit Spanne', () => {
    const lage = lageAus(TABELLE, '20259', '20251');
    expect(lage).not.toBeNull();
    expect(lage!.ungefaehr).toBe(true);
    expect(lage!.km).toBeGreaterThan(1);
    expect(lage!.km).toBeLessThan(6);
    expect(lage!.spanne).toBeGreaterThanOrEqual(0);
  });

  it('ohne Tabelle oder unbekannte Postleitzahl: keine Lage', () => {
    expect(lageAus(null, '20259', '20251')).toBeNull();
    expect(lageAus(TABELLE, '20259', '99999')).toBeNull();
    expect(lageAus(TABELLE, null, '20251')).toBeNull();
  });

  it('die Tabelle trägt Quelle und Lizenz', () => {
    expect(tabelleDatei.quelle).toContain('GeoNames');
    expect(tabelleDatei.lizenz).toBe('CC BY 4.0');
    expect(Object.keys(TABELLE).length).toBeGreaterThan(8000);
  });
});
