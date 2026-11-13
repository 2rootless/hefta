import { describe, expect, it } from 'vitest';
import { anbieterLesen } from './anbieter';

// Beispiele erfunden, in den Formen aus Probe 2.
describe('Anbieter aus der Seite', () => {
  it('„Ansprechpartnerin: Frau …“ im Text', () => {
    expect(anbieterLesen('Bei Fragen\nAnsprechpartnerin: Frau Hansen\nTelefon …')).toBe(
      'Frau Hansen',
    );
    expect(anbieterLesen('Ansprechpartner:\nHerr Dr. Brandt')).toBe('Herr Dr. Brandt');
  });

  it('ImmoScout24: die Firma unter „Über den Anbieter“', () => {
    expect(
      anbieterLesen('Lage\nÜber den Anbieter\nNordstadt Wohnen GmbH\nLessingstraße 2, 61137 Ort'),
    ).toBe('Nordstadt Wohnen GmbH');
  });

  it('Kleinanzeigen: der Name unter „Anbieter“, nicht „Privater Nutzer“', () => {
    expect(anbieterLesen('Standort\nAnbieter\nPetra K.\n\nPrivater Nutzer')).toBe('Petra K.');
    expect(anbieterLesen('Anbieter\nPrivater Nutzer\nAnzeigen-ID\n3543385570')).toBeNull();
  });

  it('geschwärzt oder nichts: null', () => {
    expect(anbieterLesen('Anbieter\n▇\n▇▇▇\n\nPrivater Nutzer')).toBeNull();
    expect(anbieterLesen('Schöne Wohnung mit Balkon')).toBeNull();
    expect(anbieterLesen(undefined)).toBeNull();
  });
});
