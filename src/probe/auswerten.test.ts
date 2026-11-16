import { describe, expect, it } from 'vitest';
import { td1Bauen, td3Bauen, mrzLesen } from '../domain/mrz';
import {
  berichtigen,
  bericht,
  mrzAuswerten,
  mrzKandidaten,
  treffer,
  type Foto,
  type Zeile,
} from './auswerten';

// Probe Vision gegen Tesseract (PC75): Die Auswertung zählt richtig, mit Gegenproben.

const z = (...texte: string[]): Zeile[] => texte.map((text) => ({ text, sicherheit: 0.9 }));

const AUSWEIS = td1Bauen({
  art: 'ID',
  aussteller: 'X',
  nummer: 'MUSTER0A1',
  geburt: '950312',
  geschlecht: '<',
  ablauf: '310801',
  staat: 'D',
  name: 'MUSTERMANN<<LEA',
});
const PASS = td3Bauen({
  art: 'P',
  aussteller: 'UTO',
  name: 'MUSTERMANN<<LEA',
  nummer: 'MUSTER0P2',
  staat: 'UTO',
  geburt: '950312',
  geschlecht: 'F',
  ablauf: '310801',
});

describe('Treffer gegen Sollwerte', () => {
  it('findet Werte auch mit anderen Leerzeichen und Strichen; einstellige zählen nicht', () => {
    const soll = { iban: 'DE00 1234 5678', betrag: '−820,00', stkl: '1', name: 'Lea Mustermann' };
    const t = treffer(soll, z('IBAN DE001234 5678', 'Miete -820,00'));
    expect(t.gefunden).toEqual(['iban', 'betrag']);
    expect(t.fehlt).toEqual(['name']);
  });
  it('Gegenprobe: ein falsches Zeichen ist kein Treffer', () => {
    expect(treffer({ nummer: 'MUSTER0A1' }, z('MUSTEROA1')).gefunden).toEqual([]);
  });
});

describe('Zeilen unten', () => {
  it('genau gelesen: gelöst und exakt', () => {
    const m = mrzAuswerten(mrzKandidaten(z('Anschrift Musterweg 7', ...AUSWEIS)), AUSWEIS);
    expect(m).toMatchObject({ geloest: true, geloestBerichtigt: true, exakt: true, falsch: 0 });
  });
  it('Leerzeichen und « aus Vision werden zu Zeichen der Norm', () => {
    const vision = AUSWEIS.map((l) => l.replace(/<</g, '«').replace(/MUSTER/, 'MUS TER'));
    expect(mrzAuswerten(mrzKandidaten(z(...vision)), AUSWEIS).geloest).toBe(true);
  });
  it('Gegenprobe: O statt 0 im Geburtsdatum ist ohne Berichtigung nicht gelöst, mit Berichtigung schon', () => {
    const falsch = [AUSWEIS[0]!, AUSWEIS[1]!.replace(/^950/, '95O'), AUSWEIS[2]!];
    const m = mrzAuswerten(mrzKandidaten(z(...falsch)), AUSWEIS);
    expect(m.geloest).toBe(false);
    expect(m.geloestBerichtigt).toBe(true);
    expect(m.falsch).toBe(1);
  });
  it('Berichtigung ergänzt Füllzeichen am Ende, aber eine falsche Prüfziffer bleibt falsch', () => {
    const kurz = [PASS[0]!.replace(/<{3}$/, ''), PASS[1]!];
    expect(mrzLesen(berichtigen(kurz, 'TD3')).ok).toBe(true);
    const ziffer = [PASS[0]!, PASS[1]!.slice(0, 9) + '7' + PASS[1]!.slice(10)];
    expect(mrzLesen(berichtigen(ziffer, 'TD3')).ok).toBe(false);
  });
  it('Berichtigung macht im Staat „UT0“ wieder „UTO“; Gegenprobe: in der Nummer bleibt O statt 0 falsch', () => {
    const staat = [PASS[0]!, PASS[1]!.slice(0, 12) + '0' + PASS[1]!.slice(13)];
    expect(staat[1]!.slice(10, 13)).toBe('UT0');
    expect(berichtigen(staat, 'TD3')[1]!.slice(10, 13)).toBe('UTO');
    expect(mrzLesen(berichtigen(staat, 'TD3')).ok).toBe(true);
    const nummer = [PASS[0]!, PASS[1]!.replace('MUSTER0P2', 'MUSTEROP2')];
    expect(mrzLesen(berichtigen(nummer, 'TD3')).ok).toBe(false);
  });
  it('Gegenprobe: eine verschluckte Prüfziffer am Ende ist nicht gelöst', () => {
    const ohne = [AUSWEIS[0]!, AUSWEIS[1]!.slice(0, 29), AUSWEIS[2]!];
    const m = mrzAuswerten(mrzKandidaten(z(...ohne)), AUSWEIS);
    expect(m.geloest).toBe(false);
    expect(m.geloestBerichtigt).toBe(false);
  });
});

describe('Zeilen unten gesamt, je Satz (PC77)', () => {
  it('zählt Fotos in OCR-B getrennt von denen aus CP40; Gegenprobe: ein Fehler zählt nicht mit', () => {
    const foto = (papier: string): Foto => ({
      datei: `${papier}-gerade.jpg`,
      papier,
      variante: 'gerade',
      soll: {},
      mrz: AUSWEIS,
    });
    const ergebnisse = [
      {
        foto: foto('ausweis-hinten'),
        laeufe: [{ weg: 'Tesseract', zeilen: z(AUSWEIS[0]!, AUSWEIS[1]!.slice(0, 29)), ms: 1 }],
      },
      {
        foto: foto('ausweis-hinten-ocrb'),
        laeufe: [
          { weg: 'Tesseract OCR-B', zeilen: z(...AUSWEIS), ms: 1 },
          { weg: 'Vision', zeilen: [], ms: 0, fehler: 'nicht im Browser' },
        ],
      },
    ];
    const text = bericht(ergebnisse, 'Test');
    expect(text).toContain('Lucida (CP40) | Tesseract | 0/1, berichtigt 0/1');
    expect(text).toContain('OCR-B | Tesseract OCR-B | 1/1, berichtigt 1/1');
    expect(text).not.toContain('OCR-B | Vision |');
    expect(text).toContain('gerade (OCR-B) | Tesseract OCR-B |');
  });
});

describe('Bericht zum Kopieren', () => {
  it('nennt je Foto und Weg Treffer, Zeit und die Zeilen unten, oben die Summen', () => {
    const foto: Foto = {
      datei: 'ausweis-hinten-gerade.jpg',
      papier: 'ausweis-hinten',
      variante: 'gerade',
      soll: { auge: 'grün', anschrift: 'Musterweg 7, 12345 Musterstadt' },
      mrz: AUSWEIS,
    };
    const text = bericht(
      [
        {
          foto,
          laeufe: [
            {
              weg: 'Vision',
              zeilen: z('grün', 'Musterweg 7, 12345 Musterstadt', ...AUSWEIS),
              ms: 812,
            },
            { weg: 'Tesseract', zeilen: [], ms: 0, fehler: 'Zeit um' },
          ],
        },
      ],
      'iPhone',
    );
    expect(text).toContain(
      'gerade | Vision | Treffer 2/2 (100 %) | unten gelöst 1/1, berichtigt 1/1 | 812 ms',
    );
    expect(text).toContain('ausweis-hinten-gerade.jpg | Vision | Treffer 2/2 (100 %)');
    expect(text).toContain('Prüfziffern gelöst');
    expect(text).toContain('ausweis-hinten-gerade.jpg | Tesseract | Fehler: Zeit um');
  });
});
