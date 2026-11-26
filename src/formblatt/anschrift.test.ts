import { describe, expect, it } from 'vitest';
import {
  anschriftAusText,
  anschriftLeer,
  anschriftLuecken,
  anschriftText,
  anschriftVollstaendig,
  anschriftZeilen,
  plzSiehtGutAus,
} from './anschrift';

// W60: Anschrift in drei Feldern.
describe('Anschrift (W60)', () => {
  const kranich = { strasse: 'Lindenring 3', plz: '20259', ort: 'Hamburg' };

  it('Zeilen und Text', () => {
    expect(anschriftZeilen(kranich)).toEqual(['Lindenring 3', '20259 Hamburg']);
    expect(anschriftText(kranich)).toBe('Lindenring 3, 20259 Hamburg');
    expect(anschriftZeilen({ strasse: '', plz: '', ort: 'Hamburg' })).toEqual(['Hamburg']);
    expect(anschriftText(null)).toBe('');
  });

  it('leer, vollständig, Lücken', () => {
    expect(anschriftLeer({ strasse: ' ', plz: '', ort: '' })).toBe(true);
    expect(anschriftVollstaendig(kranich)).toBe(true);
    expect(anschriftLuecken({ ...kranich, plz: '' })).toEqual(['plz']);
    expect(anschriftLuecken({ strasse: '', plz: '', ort: '' })).toEqual([]);
    // Gegenprobe: eine teilweise Anschrift ist weder leer noch vollständig.
    expect(anschriftLeer({ ...kranich, ort: '' })).toBe(false);
    expect(anschriftVollstaendig({ ...kranich, ort: '' })).toBe(false);
  });

  it('PLZ: fünf Ziffern, sonst nur ein Hinweis', () => {
    expect(plzSiehtGutAus('20259')).toBe(true);
    expect(plzSiehtGutAus('')).toBe(true);
    expect(plzSiehtGutAus('2025')).toBe(false);
    expect(plzSiehtGutAus('1010 Wien')).toBe(false);
  });

  it('liest ältere Anschriften aus einer Zeile, ohne etwas zu verlieren', () => {
    expect(anschriftAusText('Lindenring 3, 20259 Hamburg')).toEqual(kranich);
    expect(anschriftAusText('Lindenring 3, Erdgeschoss\n20259 Hamburg')).toEqual({
      strasse: 'Lindenring 3, Erdgeschoss',
      plz: '20259',
      ort: 'Hamburg',
    });
    expect(anschriftAusText('Lindenring 8\n22081 Hamburg, Barmbek-Süd')).toEqual({
      strasse: 'Lindenring 8',
      plz: '22081',
      ort: 'Hamburg, Barmbek-Süd',
    });
    // Ohne Postleitzahl bleibt alles in der Straße.
    expect(anschriftAusText('Postfach 12\nWien')).toEqual({
      strasse: 'Postfach 12, Wien',
      plz: '',
      ort: '',
    });
    expect(anschriftAusText('')).toEqual({ strasse: '', plz: '', ort: '' });
    // Gegenprobe: Die Hausnummer allein ist keine Postleitzahl.
    expect(anschriftAusText('Am Hang 12345').plz).toBe('');
  });
});
