import { describe, expect, it } from 'vitest';
import { adresseAus, angabenAus, portalAus, warmAus, wohnungAus } from './angaben';

describe('Vom Gelesenen zum Heft', () => {
  const adresse = {
    strasse: 'Lindenallee 3',
    plz: '20259',
    ort: 'Hamburg',
    stadtteil: 'Eimsbüttel',
  };

  it('Portal aus dem Link', () => {
    expect(portalAus('https://www.immobilienscout24.de/expose/1?x=1')).toBe('ImmoScout24');
    expect(portalAus('https://www.wg-gesucht.de/13806110.html')).toBe('WG-Gesucht');
    expect(portalAus('https://example.org/')).toBeNull();
  });

  it('Warmmiete: angegeben, sonst gerechnet und nur „ca.“', () => {
    expect(warmAus({ warm: 1961.02 })).toEqual({ warm: 1961.02, ca: false });
    expect(warmAus({ kalt: 1000, nk: 200, heiz: 80 })).toEqual({ warm: 1280, ca: true });
    expect(warmAus({ kalt: 1000, nk: 200 })).toEqual({ warm: null, ca: false });
  });

  it('Angaben und Adresse', () => {
    const a = angabenAus(
      {
        kalt: 1471.02,
        warm: 1961.02,
        zimmer: 2,
        flaeche: 59.8,
        einzug: '2026-12-01',
        befristet: false,
      },
      adresse,
      ' besonders Wohnen ',
      'https://www.immobilienscout24.de/expose/123456789',
    );
    expect(a).toMatchObject({
      titel: 'besonders Wohnen',
      stadtteil: 'Eimsbüttel',
      warm: 1961.02,
      zimmer: 2,
      flaeche: 59.8,
      einzug: '2026-12-01',
      befristung: null,
      portal: 'ImmoScout24',
    });
    expect(adresseAus(adresse)).toBe('Lindenallee 3\n20259 Hamburg');
  });

  it('nur ein Monat oder „sofort“ ist kein Einzugstag; befristet bleibt befristet', () => {
    expect(angabenAus({ einzug: '2027-02', befristet: true }, null, null, null)).toMatchObject({
      einzug: null,
      befristung: 'befristet',
    });
    expect(angabenAus({ einzug: 'sofort' }, null, null, null).einzug).toBeNull();
  });

  it('für den Abgleich: geschätzte Warmmiete nur als „ca.“', () => {
    const a = angabenAus({ kalt: 1000, nk: 200, heiz: 80 }, null, null, null);
    expect(wohnungAus(a)).toMatchObject({ warm: null, warmCa: 1280 });
  });
});
