import { describe, expect, it } from 'vitest';
import { wechselArt } from './wechsel';

describe('Bewegung beim Wechsel (Design 12.11.)', () => {
  it('der Weg zum neuen Heft', () => {
    expect(wechselArt('/wohnungen', '/wohnung-neu', 'vor')).toBe('folgen');
    expect(wechselArt('/wohnung-neu', '/wohnung-neu/vorschau', 'vor')).toBe('blende-kurz');
    expect(wechselArt('/wohnung-neu/vorschau', '/wohnung-neu/kontrolle', 'vor')).toBe('werte');
    expect(wechselArt('/wohnung-neu/kontrolle', '/heft/abc', 'vor')).toBe('heft');
    expect(wechselArt('/wohnungen', '/heft/abc', 'vor')).toBe('heft');
  });

  it('zurück, Abbrechen, Anderer Link: einheitlich zurück', () => {
    expect(wechselArt('/wohnung-neu/vorschau', '/wohnung-neu', 'zurueck')).toBe('zurueck');
    expect(wechselArt('/wuensche', '/heft/abc', 'zurueck')).toBe('zurueck');
    // PC31 (A1): zurück auf die Reiter-Wurzel „Wohnungen“ ohne Einblenden, wie PC29 bei „Mappe“.
    expect(wechselArt('/heft/abc', '/wohnungen', 'zurueck')).toBe('keine');
    expect(wechselArt('/wohnung-neu', '/wohnungen', 'zurueck')).toBe('keine');
    // Gegenprobe: vorwärts auf die Wurzel blendet weiter.
    expect(wechselArt('/einstellungen', '/wohnungen', 'vor')).toBe('einblenden');
  });

  it('Bildschirme von Version 1 und der erste Bildschirm blenden wie bisher', () => {
    expect(wechselArt('/', '/person/x', 'vor')).toBe('einblenden');
    // PC29 (A2): zurück auf „Mappe“ ohne Einblenden des ganzen Bildschirms.
    expect(wechselArt('/person/x', '/', 'zurueck')).toBe('keine');
    expect(wechselArt('/selbstauskunft/x', '/', 'zurueck')).toBe('keine');
    expect(wechselArt(null, '/wohnungen', null)).toBe('einblenden');
  });
});
