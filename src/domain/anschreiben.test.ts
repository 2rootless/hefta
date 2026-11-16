import { describe, expect, it } from 'vitest';
import { anredeAus, offenePlatzhalter, standardVorlage, vorlageFuellen } from './anschreiben';

describe('Anschreiben-Vorlage', () => {
  it('füllt die Platzhalter', () => {
    const a = vorlageFuellen(standardVorlage(), {
      anrede: anredeAus('Frau Schmidt'),
      adresse: 'Beispielstraße 1, 12345 Musterstadt',
      personen: 'zwei Erwachsene und ein Kind',
      namen: 'Max Mustermann und Lea Beispiel',
      kontakt: '0171 3920001',
    });
    expect(a.betreff).toBe('Bewerbung um die Wohnung Beispielstraße 1, 12345 Musterstadt');
    expect(a.text.startsWith('Sehr geehrte Frau Schmidt,\n')).toBe(true);
    expect(offenePlatzhalter(a)).toEqual([]);
  });

  it('lässt leere Zeilen weg und unbekannte Platzhalter stehen', () => {
    const a = vorlageFuellen(
      { betreff: '{wohnung}', text: 'Hallo\n{kontakt}\nTschüss' },
      { kontakt: '' },
    );
    expect(a.text).toBe('Hallo\nTschüss');
    expect(offenePlatzhalter(a)).toEqual(['wohnung']);
  });

  it('macht eine passende Anrede', () => {
    expect(anredeAus('herr Yilmaz')).toBe('Sehr geehrter Herr Yilmaz,');
    expect(anredeAus('Hausverwaltung Nord')).toBe('Guten Tag Hausverwaltung Nord,');
    expect(anredeAus('')).toBe('Sehr geehrte Damen und Herren,');
  });
});
