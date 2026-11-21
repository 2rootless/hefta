import { describe, expect, it } from 'vitest';
import { tagText, tagZusammen } from './index';

// DP50 Ü3: „31. März 2027“ wird nie getrennt (geschütztes Leerzeichen nach dem Tag, C23).
describe('Datum zusammen', () => {
  it('Tag und Monat stehen zusammen', () => {
    expect(tagText('2027-03-31')).toBe('31. März 2027');
    // Gegenprobe: Ein Datum mit gewöhnlichem Leerzeichen setzt tagZusammen zusammen.
    expect(tagZusammen('31. März 2027')).toBe('31. März 2027');
  });
});
