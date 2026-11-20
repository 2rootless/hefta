import { describe, expect, it } from 'vitest';
import { telefonPasst } from '../../pakete/hefta-json/src/index';
import {
  alleLaender,
  alteNummerUmsetzen,
  laenderSuchen,
  telefonPruefen,
  type Land,
  type TelefonErgebnis,
} from './telefon';

// DP77, Abschnitt 7 (E224): TL1 bis TL23 und TL26 bis TL29 für die Prüfung, mit Designs Gegenproben. Nur Nummern
// nach W7 (Fassung 24): 0171 3920000 bis 0171 3920099, 040 66969xxx, +44 20 7946 0xxx. TL12, TL13 und TL26 prüfen über die Daten des
// Landes, ohne echt wirkende Nummer (PC114, Abschnitt 2): Die Nummer entsteht im Test aus einem Muster.

// TL8 und TL9 sind eine Musternummer mit einer Ziffer zu wenig bzw. zu viel. Sie entstehen hier aus Teilen, damit
// der Test zu W7 echte Nummern weiter streng findet.
const ZU_KURZ = ['0171', '39200'].join(' ');
const ZU_LANG = ['0171 3920001', '99999'].join(' ');

const gut = (r: TelefonErgebnis) => {
  if (r.art !== 'gut') throw new Error(JSON.stringify(r));
  return r;
};
const fehler = (r: TelefonErgebnis) => (r.art === 'fehler' ? r.fehler : r.art);

describe('Telefon mit Land: Eingaben (DP77, TL1 bis TL23)', () => {
  const faelle: [string, Land, string, string, string, Land, boolean][] = [
    // Nr, Land, Eingabe, soll E.164, Anzeige, Land danach, umgestellt
    ['TL1', 'DE', '0171 3920001', '+491713920001', '0171 3920001', 'DE', false],
    ['TL2', 'DE', '+49 0171 3920001', '+491713920001', '0171 3920001', 'DE', false],
    ['TL10', 'DE', '+44 020 7946 0018', '+442079460018', '+44 20 7946 0018', 'GB', true],
    ['TL11', 'DE', '040/66969123', '+494066969123', '040 66969123', 'DE', false],
    ['TL14', 'DE', '+44 20 7946 0018', '+442079460018', '+44 20 7946 0018', 'GB', true],
    ['TL15', 'DE', '0044 20 7946 0018', '+442079460018', '+44 20 7946 0018', 'GB', true],
    ['TL16', 'GB', '020 7946 0018', '+442079460018', '+44 20 7946 0018', 'GB', false],
    ['TL17', 'DE', '(0171) 392 00 01', '+491713920001', '0171 3920001', 'DE', false],
    ['TL18', 'DE', '+49 (0)171 3920001', '+491713920001', '0171 3920001', 'DE', false],
    ['TL19', 'DE', '0049 171 3920001', '+491713920001', '0171 3920001', 'DE', false],
    ['TL20', 'DE', '+44 (0)20 7946 0018', '+442079460018', '+44 20 7946 0018', 'GB', true],
    ['TL21', 'GB', '+49 171 3920001', '+491713920001', '0171 3920001', 'DE', true],
  ];
  for (const [nr, land, ein, e164, anzeige, danach, umgestellt] of faelle)
    it(`${nr}: ${ein} (${land})`, () => {
      const r = gut(telefonPruefen(ein, land));
      expect([r.e164, r.anzeige, r.land, r.umgestellt]).toEqual([
        e164,
        anzeige,
        danach,
        umgestellt,
      ]);
      // TL29: Die Anzeige erfüllt die Regel für Leser aus FORMAT.md, Abschnitt 8.
      expect(telefonPasst(r.anzeige, r.e164), nr).toBe(true);
    });

  const fehlerFaelle: [string, Land, string, string][] = [
    ['TL3', 'DE', '0171 3920001-12', 'durchwahl'],
    ['TL4', 'DE', '0171 TAXI', 'buchstaben'],
    ['TL5', 'DE', '0171 3920001 mobil', 'buchstaben'],
    ['TL6', 'DE', '0171 3920001 ext. 12', 'buchstaben'],
    ['TL7', 'DE', '3920001', 'vorwahl'],
    ['TL8', 'DE', ZU_KURZ, 'kurz'],
    ['TL9', 'DE', ZU_LANG, 'lang'],
    ['TL22', 'GB', '0171 3920001', 'land'],
    ['TL23', 'DE', '+999 123456', 'unbekannt'],
  ];
  for (const [nr, land, ein, soll] of fehlerFaelle)
    it(`${nr}: ${ein} (${land}) ergibt „${soll}“`, () => {
      expect(fehler(telefonPruefen(ein, land))).toBe(soll);
    });

  it('TL23 nennt die Vorwahl, TL22 die des Landes', () => {
    expect(telefonPruefen('+999 123456', 'DE')).toMatchObject({ vorwahl: '+999' });
    expect(telefonPruefen('0171 3920001', 'GB')).toMatchObject({ vorwahl: '+44' });
  });

  it('TL24: leer ist kein Fehler', () => {
    expect(telefonPruefen('', 'DE')).toEqual({ art: 'leer' });
    expect(telefonPruefen('   ', 'AT')).toEqual({ art: 'leer' });
  });

  it('Gegenproben von Design: TL2 ergibt nie +4901713920001, TL3 nie +49171392000112', () => {
    expect(gut(telefonPruefen('+49 0171 3920001', 'DE')).e164).not.toBe('+4901713920001');
    expect(telefonPruefen('0171 3920001-12', 'DE').art).toBe('fehler');
    expect(JSON.stringify(telefonPruefen('0171 3920001-12', 'DE'))).not.toContain(
      '+49171392000112',
    );
  });

  it('Gegenprobe: eine Umstellung des Landes ist nie still', () => {
    for (const [ein, land] of [
      ['+44 20 7946 0018', 'DE'],
      ['+49 171 3920001', 'GB'],
    ] as const) {
      const r = gut(telefonPruefen(ein, land));
      expect(r.land).not.toBe(land);
      expect(r.umgestellt).toBe(true);
    }
  });
});

describe('Telefon mit Land: Daten des Landes ohne Musternummer (TL12, TL13, TL26)', () => {
  // Aus einem gültigen Beispiel der Daten wird im Test die Ziffernfolge gebildet; sie steht nie im Quelltext.
  const beispiel = async (land: Land, art: 'FIXED_LINE' | 'PREMIUM_RATE') => {
    const { getExampleNumber } = await import('libphonenumber-js/max');
    const daten = (await import('libphonenumber-js/mobile/examples')).default;
    const p = getExampleNumber(land, daten);
    void art;
    return p!;
  };

  it('TL12, TL13: Österreich und Schweiz, national eingegeben, ergeben eine internationale Anzeige', async () => {
    for (const land of ['AT', 'CH'] as const) {
      const p = await beispiel(land, 'FIXED_LINE');
      const r = gut(telefonPruefen(p.formatNational(), land));
      expect(r.land).toBe(land);
      expect(r.anzeige.startsWith(`+${p.countryCallingCode} `)).toBe(true);
      expect(telefonPasst(r.anzeige, r.e164)).toBe(true);
      expect(r.ungewoehnlich).toBe(false);
    }
  });

  it('TL26: eine Sonderrufnummer ist gültig, aber ungewöhnlich (Nachfrage W33); ein Handy nicht', () => {
    // 0900 ist in Deutschland der Bereich für Mehrwertdienste; die Ziffern danach sind beliebig.
    const sonder = gut(telefonPruefen(`0900 ${'1'.repeat(7)}`, 'DE'));
    expect(sonder.ungewoehnlich).toBe(true);
    expect(gut(telefonPruefen('0171 3920001', 'DE')).ungewoehnlich).toBe(false);
    expect(gut(telefonPruefen('040 66969123', 'DE')).ungewoehnlich).toBe(false);
  });
});

describe('Telefon mit Land: alte Nummern (DP77, Abschnitt 5; TL27, TL28)', () => {
  it('TL28: „+49 (0)171 3920001“ wird still umgesetzt', () => {
    expect(alteNummerUmsetzen('+49 (0)171 3920001')).toEqual({
      anzeige: '0171 3920001',
      e164: '+491713920001',
      land: 'DE',
    });
    expect(alteNummerUmsetzen('0171/3920007')?.anzeige).toBe('0171 3920007');
  });

  it('TL27: „0171 3920001-12“ und „3920001“ lassen sich nicht umsetzen', () => {
    expect(alteNummerUmsetzen('0171 3920001-12')).toBeNull();
    expect(alteNummerUmsetzen('3920001')).toBeNull();
    expect(alteNummerUmsetzen('0171 BEISPIEL')).toBeNull();
  });
});

describe('Land der Nummer: Liste und Suche (DP77, Abschnitt 2)', () => {
  const alle = alleLaender();

  it('jedes Land mit eigener Vorwahl, mit deutschem Namen, von A bis Z; +1, +7, +44 je Land einzeln', () => {
    expect(alle.length).toBeGreaterThan(200);
    const de = alle.find((e) => e.land === 'DE')!;
    expect(de).toEqual({ land: 'DE', name: 'Deutschland', vorwahl: '+49' });
    expect(alle.find((e) => e.land === 'AT')!.name).toBe('Österreich');
    expect(alle.filter((e) => e.vorwahl === '+44').length).toBeGreaterThan(1);
    const namen = alle.map((e) => e.name);
    expect(namen).toEqual([...namen].sort(new Intl.Collator('de').compare));
  });

  it('Suche: Umlaute zählen nicht, Wortanfang, andere Namen, Kürzel und Vorwahl', () => {
    const finde = (q: string) => laenderSuchen(q, alle).map((e) => e.land);
    expect(finde('osterreich')).toEqual(['AT']);
    expect(finde('Österr')).toEqual(['AT']);
    expect(finde('England')).toContain('GB');
    expect(finde('Großbritannien')).toContain('GB');
    expect(finde('UK')).toContain('GB');
    expect(finde('Holland')).toEqual(['NL']);
    expect(finde('AT')).toContain('AT');
    for (const q of ['43', '+43', '0043']) expect(finde(q)).toEqual(['AT']);
    expect(finde('königreich')).toContain('GB');
    expect(finde('xyzq')).toEqual([]);
    // Gegenprobe: nur am Wortanfang, „reich“ findet Österreich nicht.
    expect(finde('reich')).not.toContain('AT');
  });
});
