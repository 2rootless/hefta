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
    expect(wechselArt('/heft/abc', '/wohnungen', 'zurueck')).toBe('zurueck');
  });

  it('Bildschirme von Version 1 und der erste Bildschirm blenden wie bisher', () => {
    expect(wechselArt('/', '/person/x', 'vor')).toBe('einblenden');
    expect(wechselArt('/person/x', '/', 'zurueck')).toBe('einblenden');
    expect(wechselArt(null, '/wohnungen', null)).toBe('einblenden');
  });
});
