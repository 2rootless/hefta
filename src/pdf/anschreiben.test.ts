import { PDFDocument } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { standardVorlage, vorlageFuellen } from '../domain/anschreiben';
import { pdfSchriften, textJeSeite } from '../test/hilfen';
import { anschreibenBauen } from './anschreiben';

describe('Anschreiben-PDF (Version 2)', () => {
  it('eine Seite mit Betreff und Text, neutrale Metadaten', async () => {
    const anschreiben = vorlageFuellen(standardVorlage(), {
      anrede: 'Sehr geehrte Frau Schmidt,',
      adresse: 'Hauptstraße 12',
      personen: 'zwei Erwachsene und ein Kind',
      namen: 'Max Mustermann und Lea Beispiel',
      kontakt: '0170 1234567',
    });
    const { bytes, seiten } = await anschreibenBauen({
      dateiname: '00_Anschreiben_Mustermann.pdf',
      absender: ['Max Mustermann und Lea Beispiel', 'Friedensallee 1, 22761 Hamburg'],
      empfaenger: ['Frau Schmidt', 'Hausverwaltung Nord'],
      ortDatum: 'Hamburg, 6. November 2026',
      anschreiben,
      fussName: 'Mustermann',
      schriften: pdfSchriften(),
      datum: new Date(2026, 10, 6),
    });
    expect(seiten).toBe(1);
    const text = (await textJeSeite(bytes))[0]!;
    expect(text).toContain('Bewerbung um die Wohnung Hauptstraße 12');
    expect(text).toContain('Sehr geehrte Frau Schmidt,');
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(pdf.getTitle()).toBe('00_Anschreiben_Mustermann');
    expect(pdf.getProducer()).toBeUndefined();
  });

  it('bricht langen Text auf weitere Seiten um', async () => {
    const { seiten } = await anschreibenBauen({
      dateiname: 'lang.pdf',
      absender: ['Max'],
      empfaenger: [],
      ortDatum: 'Hamburg, 6. November 2026',
      anschreiben: { betreff: 'Bewerbung', text: 'Ein Satz über uns. '.repeat(400) },
      fussName: 'Mustermann',
      schriften: pdfSchriften(),
    });
    expect(seiten).toBeGreaterThan(1);
  });
});
