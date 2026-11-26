import { describe, expect, it } from 'vitest';
import { haushaltsAngaben, selbstauskunftBloecke } from './selbstauskunft';
import { personAusBogen, leerePerson } from './bogen';

// PC208, Schritt 5 (W28, DP134 Abschnitt 1): Der Schein ist eine Angabe des Haushalts. Im PDF steht er unter HAUSHALT nur in
// einer Mappe für eine Sozialwohnung und nur mit Antwort.

const person = personAusBogen(
  { ...leerePerson('p'), vorname: 'Jarne', nachname: 'Ostendorp' },
  { erwachsene: 1, kinder: 0, haustiere: null, wbs: null, ort: '' },
  '2026-11-25T10:00:00.000Z',
);
const zeilen = (wbs: 'ja' | 'nein' | null, wbsZeile: boolean) =>
  selbstauskunftBloecke(
    person,
    'vertrag',
    { erwachsene: 1, kinder: 0 },
    haushaltsAngaben({ wbsAngabe: wbs }),
    'will_wohnung',
    { wbsZeile },
  )
    .find((b) => b.id === 'haushalt')!
    .zeilen.map((z) => [z.id, 'wert' in z ? z.wert : z.antwort]);

describe('Wohnberechtigungsschein in der App', () => {
  it('wird aus dem Haushalt gelesen', () => {
    expect(haushaltsAngaben({ wbsAngabe: 'ja' }).wbs).toBe('ja');
    expect(haushaltsAngaben(null).wbs ?? null).toBeNull();
  });

  it('steht im PDF nur bei einer Sozialwohnung und mit Antwort', () => {
    expect(zeilen('ja', true)).toContainEqual(['wbs', 'Ja']);
    expect(zeilen('nein', true)).toContainEqual(['wbs', 'Nein']);
    expect(zeilen(null, true).map(([id]) => id)).not.toContain('wbs');
    // Gegenprobe: ohne Sozialwohnung nie.
    expect(zeilen('ja', false).map(([id]) => id)).not.toContain('wbs');
  });
});
