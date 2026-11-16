import { describe, expect, it } from 'vitest';
import { wohnungsSchluessel, wohnungTeile } from './adresse';

describe('Adresse in Teilen (E6)', () => {
  it.each([
    [
      'Beispielstraße 1, 3. OG links\n12345 Musterstadt',
      {
        strasse: 'Beispielstraße',
        hausnummer: '1',
        lage: '3. OG links',
        plz: '12345',
        ort: 'Musterstadt',
      },
    ],
    [
      'Große Beispielstraße 1, Hinterhaus, 4. OG rechts\n12345 Musterstadt-Nord',
      {
        strasse: 'Große Beispielstraße',
        hausnummer: '1',
        lage: 'Hinterhaus, 4. OG rechts',
        plz: '12345',
        ort: 'Musterstadt-Nord',
      },
    ],
    [
      'Am Musterplatz 1\n12345 Musterstadt',
      { strasse: 'Am Musterplatz', hausnummer: '1', lage: '', plz: '12345', ort: 'Musterstadt' },
    ],
    [
      // Ohne Postleitzahl und Ort (PC56: Musteradresse statt einer echten Straße).
      'Am Musterplatz 1',
      { strasse: 'Am Musterplatz', hausnummer: '1', lage: '', plz: '', ort: '' },
    ],
    [
      'Musterweg 7 a, 22761 Hamburg',
      { strasse: 'Musterweg', hausnummer: '7a', lage: '', plz: '22761', ort: 'Hamburg' },
    ],
    ['Lindenring 3-5', { strasse: 'Lindenring', hausnummer: '3-5', lage: '', plz: '', ort: '' }],
  ])('%s', (adresse, erwartet) => {
    expect(wohnungTeile(adresse)).toEqual(erwartet);
  });

  it('ohne Hausnummer: keine Teile, nur das freie Feld', () => {
    expect(wohnungTeile('Am Markt')).toBeNull();
    expect(wohnungTeile('')).toBeNull();
  });

  it('Schlüssel: gleich bei anderer Schreibweise, verschieden bei anderer Wohnung', () => {
    const a = wohnungsSchluessel('Beispielstraße 1, 3. OG links\n12345 Musterstadt');
    expect(wohnungsSchluessel('Beispielstr. 1,  3.OG links\n12345  Musterstadt')).toBe(a);
    expect(wohnungsSchluessel('Beispielstraße 1, 3. OG rechts\n12345 Musterstadt')).not.toBe(a);
    expect(wohnungsSchluessel('Musterweg 7, 3. OG links\n12345 Musterstadt')).not.toBe(a);
  });
});
