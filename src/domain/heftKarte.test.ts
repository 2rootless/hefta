import { describe, expect, it } from 'vitest';
import {
  zurueckZumHeft,
  eckdaten,
  heftAdresseKurz,
  heftOrt,
  heftTitel,
  terminKarte,
  terminKurz,
} from './heftKarte';

const NB = ' ';
const ohne = { adresse: 'Methfesselstraße 12\n20255 Hamburg' };
const mit = {
  adresse: 'Lindenallee 3, EG\n20259 Hamburg',
  angaben: {
    titel: 'Helle 3-Zimmer-Wohnung',
    merkmal: 'Altbau mit Garten',
    stadtteil: 'Eimsbüttel',
    warm: 1240,
    zimmer: 2.5,
    flaeche: 74,
  },
};

describe('Kopf eines Hefts', () => {
  it('nimmt das Merkmal, sonst den Titel, sonst die Straße', () => {
    expect(heftTitel(mit)).toEqual({ text: 'Altbau mit Garten', strasse: false });
    expect(heftTitel({ ...mit, angaben: { ...mit.angaben, merkmal: null } }).text).toBe(
      'Helle 3-Zimmer-Wohnung',
    );
    expect(heftTitel(ohne)).toEqual({ text: 'Methfesselstraße 12', strasse: true });
  });

  it('Titel ohne Titel und ohne Straße: gebaut nach E78', () => {
    const leer = { adresse: '', createdAt: new Date(2026, 10, 11, 9).toISOString() };
    const mitA = (angaben: Record<string, unknown>) =>
      heftTitel({ ...leer, angaben: angaben as never }).text;
    expect(mitA({ zimmer: 2, stadtteil: 'Eimsbüttel', portal: 'ImmoScout24' })).toBe(
      '2-Zimmer-Wohnung in Eimsbüttel',
    );
    expect(mitA({ zimmer: 2.5, stadtteil: 'Eimsbüttel' })).toBe('2,5-Zimmer-Wohnung in Eimsbüttel');
    expect(mitA({ zimmer: null, stadtteil: 'Eimsbüttel' })).toBe('Wohnung in Eimsbüttel');
    expect(mitA({ zimmer: 2, stadtteil: null, portal: 'ImmoScout24' })).toBe(
      '2-Zimmer-Wohnung bei ImmoScout24',
    );
    expect(mitA({ zimmer: null, portal: 'ImmoScout24' })).toBe('Inserat bei ImmoScout24');
    expect(mitA({ zimmer: 2 })).toBe(`Wohnung vom 11.${NB}Nov.`);
    expect(heftTitel(leer).text).toBe(`Wohnung vom 11.${NB}Nov.`);
    // Ein Merkmal ersetzt den gebauten Titel; der gebaute Titel ist kein Straßentitel.
    expect(mitA({ zimmer: 2, stadtteil: 'Eimsbüttel', merkmal: 'Die mit dem Erker' })).toBe(
      'Die mit dem Erker',
    );
    expect(heftTitel({ ...leer, angaben: { stadtteil: 'Eimsbüttel' } as never }).strasse).toBe(
      false,
    );
  });

  it('Ort: Stadtteil, sonst der Ort ohne Postleitzahl', () => {
    expect(heftOrt(mit)).toBe('Eimsbüttel');
    expect(heftOrt(ohne)).toBe('Hamburg');
    expect(heftAdresseKurz(mit)).toBe('Lindenallee 3, EG · Eimsbüttel');
  });

  it('Eckdaten mit Komma, festen Leerzeichen und „ca.“', () => {
    expect(eckdaten(mit)).toBe(`1.240${NB}€ · 2,5${NB}Zi · 74${NB}m²`);
    expect(
      eckdaten({
        angaben: { ...mit.angaben, warmCa: true, flaecheCa: true, warm: 980, flaeche: 55 },
      }),
    ).toBe(`ca.${NB}980${NB}€ · 2,5${NB}Zi · ca.${NB}55${NB}m²`);
    expect(eckdaten({ angaben: undefined })).toBe('');
  });
});

describe('Karte der Besichtigung', () => {
  const jetzt = new Date(2026, 10, 8, 20, 0); // So, 8. Nov.

  it('morgen 17:30: Datum, Uhr, Woche mit Montag und Ereignis', () => {
    const k = terminKarte(new Date(2026, 10, 9, 17, 30).toISOString(), jetzt);
    expect(k).toMatchObject({
      wochentag: 'Mo',
      tag: 9,
      monat: 'Nov.',
      uhr: '17:30',
      tage: 1,
      ereignis: 1,
    });
    expect(k.woche).toHaveLength(15);
    expect(k.woche[1]?.montag).toBe(true);
    expect(k.woche[8]?.montag).toBe(true);
    expect(k.woche[0]?.montag).toBe(false);
  });

  it('weiter als zwei Wochen: kein Ereignis in der Woche', () => {
    expect(terminKarte(new Date(2026, 10, 30, 10).toISOString(), jetzt).ereignis).toBeNull();
  });

  it('ohne Uhrzeit bleibt die Uhr leer', () => {
    expect(terminKarte(new Date(2026, 10, 9).toISOString(), jetzt).uhr).toBe('');
  });

  it('kurzes Datum', () => {
    expect(terminKurz(new Date(2026, 10, 12, 18).toISOString(), true)).toBe('Do, 18:00');
    expect(terminKurz(new Date(2026, 10, 6, 18).toISOString(), false)).toBe(`Fr, 6.${NB}Nov.`);
  });
});

describe('Zurück-Link von den Seiten im Heft (P003)', () => {
  const heft = (adresse: string, merkmal?: string) => ({
    adresse,
    angaben: merkmal ? ({ merkmal } as never) : undefined,
  });
  it('nimmt das Merkmal, sonst die Straße', () => {
    expect(zurueckZumHeft(heft('Lindenallee 3\n20259 Hamburg', 'Mit Balkon'))).toBe('Mit Balkon');
    expect(zurueckZumHeft(heft('Lindenallee 3\n20259 Hamburg'))).toBe('Lindenallee 3');
  });
  it('ab 15 Zeichen oder ohne Namen bleibt „Heft“', () => {
    expect(zurueckZumHeft(heft('Lindenallee 3, EG'))).toBeNull(); // 17 Zeichen
    expect(zurueckZumHeft(heft('Rosenweg 12345A'))).toBeNull(); // genau 15
    expect(zurueckZumHeft(heft('Rosenweg 1234A'))).toBe('Rosenweg 1234A'); // 14
    expect(zurueckZumHeft(heft(''))).toBeNull();
    expect(zurueckZumHeft(null)).toBeNull();
  });
});

describe('PC8 B3: Miete in den Eckdaten', () => {
  it('nennt ohne Warmmiete die Kaltmiete mit „kalt“', () => {
    expect(eckdaten({ angaben: { kalt: 1471.02, zimmer: 2 } as never })).toBe(
      '1.471 € kalt · 2 Zi',
    );
    expect(eckdaten({ angaben: { warm: 1961, kalt: 1471 } as never })).toBe('1.961 €');
  });
});
