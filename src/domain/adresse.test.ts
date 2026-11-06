import { describe, expect, it } from 'vitest';
import { wohnungsSchluessel, wohnungTeile } from './adresse';

describe('Adresse in Teilen (E6)', () => {
  it.each([
    [
      'Hauptstraße 12, 3. OG links\n22767 Hamburg',
      {
        strasse: 'Hauptstraße',
        hausnummer: '12',
        lage: '3. OG links',
        plz: '22767',
        ort: 'Hamburg',
      },
    ],
    [
      'Große Bergstraße 152, Hinterhaus, 4. OG rechts\n22767 Hamburg-Altona',
      {
        strasse: 'Große Bergstraße',
        hausnummer: '152',
        lage: 'Hinterhaus, 4. OG rechts',
        plz: '22767',
        ort: 'Hamburg-Altona',
      },
    ],
    [
      'Am Wall 140\n28195 Bremen',
      { strasse: 'Am Wall', hausnummer: '140', lage: '', plz: '28195', ort: 'Bremen' },
    ],
    [
      'Bahrenfelder Ch. 41',
      { strasse: 'Bahrenfelder Ch.', hausnummer: '41', lage: '', plz: '', ort: '' },
    ],
    [
      'Musterweg 3 a, 22761 Hamburg',
      { strasse: 'Musterweg', hausnummer: '3a', lage: '', plz: '22761', ort: 'Hamburg' },
    ],
    ['Lindenallee 3-5', { strasse: 'Lindenallee', hausnummer: '3-5', lage: '', plz: '', ort: '' }],
  ])('%s', (adresse, erwartet) => {
    expect(wohnungTeile(adresse)).toEqual(erwartet);
  });

  it('ohne Hausnummer: keine Teile, nur das freie Feld', () => {
    expect(wohnungTeile('Am Markt')).toBeNull();
    expect(wohnungTeile('')).toBeNull();
  });

  it('Schlüssel: gleich bei anderer Schreibweise, verschieden bei anderer Wohnung', () => {
    const a = wohnungsSchluessel('Hauptstraße 12, 3. OG links\n22767 Hamburg');
    expect(wohnungsSchluessel('Hauptstr. 12,  3.OG links\n22767  Hamburg')).toBe(a);
    expect(wohnungsSchluessel('Hauptstraße 12, 3. OG rechts\n22767 Hamburg')).not.toBe(a);
    expect(wohnungsSchluessel('Hauptstraße 14, 3. OG links\n22767 Hamburg')).not.toBe(a);
  });
});
