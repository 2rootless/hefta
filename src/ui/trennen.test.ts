import { describe, expect, it } from 'vitest';
import { weichTrennen } from './trennen';

const sichtbar = (s: string) => s.replaceAll('­', '|');

describe('Weiche Trennstellen in langen Namen (DP45 G5)', () => {
  it('trennt nur an sicheren Fugen', () => {
    expect(sichtbar(weichTrennen('Wohnungsgenossenschaft Muster eG'))).toBe(
      'Wohnungs|genossen|schaft Muster eG',
    );
    expect(sichtbar(weichTrennen('Hausverwaltung Beispiel GmbH'))).toBe(
      'Haus|verwaltung Beispiel GmbH',
    );
  });

  it('lässt kurze und unbekannte Wörter, wie sie sind', () => {
    expect(weichTrennen('Muster eG')).toBe('Muster eG');
    expect(weichTrennen('Donaudampfschifffahrt')).toBe('Donaudampfschifffahrt');
    expect(weichTrennen('Gesellschaft')).toBe('Gesellschaft');
  });
});
