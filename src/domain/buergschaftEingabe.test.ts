import { describe, expect, it } from 'vitest';
import {
  angabenAusEingabe,
  BUERGSCHAFT_FORMULAR,
  buergschaftKnopf,
  buergschaftStand,
  eingabeFuer,
  entwurfAus,
  leereEingabe,
  wohnungText,
  type BuergschaftWerte,
} from './buergschaftEingabe';
import { fehlendeFelder } from '../formblatt/formblatt';

// W63: Die Bürgschaft in vier Teilen auf dem Formblatt; nötig sind nur Höchstbetrag und Art (E112).
const HEFT = {
  anschrift: { strasse: 'Lindenring 8', plz: '20259', ort: 'Hamburg' },
  vermieterName: 'Hausverwaltung Musterplatz',
  wohnungZeilen: ['Lindenring 3, 2. OG links', '20259 Hamburg'],
  einzug: '2027-01-01',
};

const werte = (e = eingabeFuer(null, HEFT)): BuergschaftWerte => ({
  e,
  name: 'Petra Mustermann',
  mieter: ['Max Mustermann', 'Lea Mustermann'],
});

describe('Bürgschaft auf dem Formblatt (W63)', () => {
  it('vorbelegt aus Person und Heft, die Lage aus der ersten Zeile der Adresse', () => {
    const e = eingabeFuer(null, HEFT);
    expect(e.anschrift).toEqual({ strasse: 'Lindenring 8', plz: '20259', ort: 'Hamburg' });
    expect(e.wohnung).toEqual({ strasse: 'Lindenring 3', plz: '20259', ort: 'Hamburg' });
    expect(e.lage).toBe('2. OG links');
    expect(e.vermieterName).toBe('Hausverwaltung Musterplatz');
    expect(e.vertragTag).toBe('2027-01-01');
    expect(wohnungText(e)).toBe('Lindenring 3, 2. OG links, 20259 Hamburg');
    // Ältere Daten: die Anschrift als Zeile.
    expect(eingabeFuer(null, { anschriftText: 'Musterweg 7, 20259 Hamburg' }).anschrift).toEqual({
      strasse: 'Musterweg 7',
      plz: '20259',
      ort: 'Hamburg',
    });
  });

  it('ein gespeicherter Entwurf geht vor, auch wenn das Heft sich geändert hat', () => {
    const e = { ...eingabeFuer(null, HEFT), hoechstbetrag: 3600, lage: '' };
    const entwurf = entwurfAus(e, '2026-11-25T10:00:00.000Z');
    expect(entwurf.geaendert).toBe('2026-11-25T10:00:00.000Z');
    const wieder = eingabeFuer(entwurf, { ...HEFT, vermieterName: 'Andere GmbH' });
    expect(wieder.vermieterName).toBe('Hausverwaltung Musterplatz');
    expect(wieder.hoechstbetrag).toBe(3600);
    expect(wieder).not.toHaveProperty('geaendert');
  });

  it('nötig sind nur Höchstbetrag und Art; freiwillige Lücken lassen den Teil fertig, aber nicht voll', () => {
    expect(fehlendeFelder(BUERGSCHAFT_FORMULAR, werte()).map((f) => f.id)).toEqual([
      'hoechstbetrag',
      'art',
    ]);
    const stand = buergschaftStand(werte());
    expect(stand.map((s) => s.id)).toEqual(['wer', 'fuerWen', 'wohnung', 'betrag']);
    expect(stand.map((s) => [s.fertig, s.voll])).toEqual([
      [true, true],
      // Die Anschrift des Vermieters fehlt: freiwillig, sie bleibt für die Hand.
      [true, false],
      [true, true],
      [false, false],
    ]);
    // Die Lage ist ein Zusatz: Ohne sie ist die Wohnung trotzdem voll.
    const ohneLage = buergschaftStand(werte({ ...eingabeFuer(null, HEFT), lage: '' }));
    expect(ohneLage.find((s) => s.id === 'wohnung')?.voll).toBe(true);
  });

  it('Hauptknopf: Weiter zum nächsten offenen Teil, freiwillige Lücken halten nicht auf', () => {
    const stand = buergschaftStand(werte());
    expect(buergschaftKnopf(stand, null)).toEqual({ art: 'weiter', ziel: 'fuerWen' });
    expect(buergschaftKnopf(stand, 'fuerWen')).toEqual({ art: 'weiter', ziel: 'betrag' });
    // Nur noch im offenen Teil fehlt Nötiges: blass, der Satz sagt, was fehlt.
    expect(buergschaftKnopf(stand, 'betrag')).toEqual({ art: 'blass' });
    const fertig = buergschaftStand(
      werte({ ...eingabeFuer(null, HEFT), hoechstbetrag: 3600, art: 'ausfall' }),
    );
    expect(buergschaftKnopf(fertig, 'betrag')).toEqual({ art: 'fertig' });
    // Nach dem letzten Teil geht es nur zu einem zurück, dem Nötiges fehlt.
    const leer = buergschaftStand(werte(leereEingabe()));
    expect(buergschaftKnopf(leer, 'betrag')).toEqual({ art: 'blass' });
    expect(buergschaftKnopf(leer, 'wohnung')).toEqual({ art: 'weiter', ziel: 'betrag' });
  });

  it('Angaben fürs PDF: Anschriften als Zeile, Namen aus dem Haushalt', () => {
    const a = angabenAusEingabe(
      werte({ ...eingabeFuer(null, HEFT), hoechstbetrag: 3600, art: 'selbstschuldnerisch' }),
    );
    expect(a.buerge).toEqual({
      name: 'Petra Mustermann',
      anschrift: 'Lindenring 8, 20259 Hamburg',
    });
    expect(a.mieter).toEqual(['Max Mustermann', 'Lea Mustermann']);
    expect(a.vermieter).toEqual({ name: 'Hausverwaltung Musterplatz', anschrift: '' });
    expect(a.wohnung).toBe('Lindenring 3, 2. OG links, 20259 Hamburg');
    expect(a.art).toBe('selbstschuldnerisch');
    expect(a.bezeichnung).toBe('neutral');
  });
});
