import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { pdfSchriften, testJpeg, textJeSeite } from '../test/hilfen';
import { druckTon, mappeBauen, PERSONENFARBEN, titelAusDateiname } from './mappe';

async function quellPdf(seiten: string[], format: [number, number] = [595.28, 841.89]) {
  const pdf = await PDFDocument.create();
  const schrift = await pdf.embedFont(StandardFonts.Helvetica);
  for (const text of seiten) {
    pdf.addPage(format).drawText(text, { x: 50, y: 700, size: 14, font: schrift });
  }
  pdf.setProducer('Lohnportal 3000');
  pdf.setAuthor('Arbeitgeber GmbH');
  return pdf.save();
}

describe('PDF-Mappe', () => {
  it('hat Deckblatt, Teile in fester Reihenfolge und richtige Seitenzahlen', async () => {
    const ergebnis = await mappeBauen({
      dateiname: 'Bewerbung_Mustermann_Hauptstr12.pdf',
      fussName: 'Max und Lea Mustermann',
      deckblatt: {
        kopf: 'Bewerbung um die Wohnung',
        titel: ['Hauptstraße 12, 3. OG links', '22767 Hamburg'],
        satz: 'Wir sind ein ruhiges Paar mit einem Kind.',
      },
      teile: [
        { art: 'bild', jpeg: testJpeg(1654, 2339), abschnitt: 'Gehaltsnachweise Max' },
        {
          art: 'pdf',
          daten: await quellPdf(['Abrechnung A', 'Abrechnung B', 'Abrechnung C']),
          abschnitt: 'Gehaltsnachweise Lea',
          seiten: [2, 0],
        },
        {
          art: 'pdf',
          daten: await quellPdf(['Querformat'], [841.89, 595.28]),
          abschnitt: 'Bonitätsnachweis',
        },
      ],
      schriften: pdfSchriften(),
    });

    expect(ergebnis.seiten).toBe(5);
    expect(ergebnis.inhalt).toEqual([
      { abschnitt: 'Gehaltsnachweise Max', seite: 2 },
      { abschnitt: 'Gehaltsnachweise Lea', seite: 3 },
      { abschnitt: 'Bonitätsnachweis', seite: 5 },
    ]);

    const text = await textJeSeite(ergebnis.bytes);
    expect(text).toHaveLength(5);
    expect(text[0]).toContain('Hauptstraße 12, 3. OG links');
    expect(text[0]).toContain('Gehaltsnachweise Lea');
    expect(text[0]).toContain('Seite 1 von 5');
    expect(text[2]).toContain('Abrechnung C');
    expect(text[3]).toContain('Abrechnung A');
    expect(text[4]).toContain('Seite 5 von 5');

    const geladen = await PDFDocument.load(ergebnis.bytes, { updateMetadata: false });
    for (const seite of geladen.getPages()) {
      expect(seite.getSize()).toEqual({ width: 595.28, height: 841.89 });
    }
  });

  it('schreibt neutrale Metadaten: Titel = Dateiname, kein Producer, Creator oder Autor', async () => {
    const ergebnis = await mappeBauen({
      dateiname: 'Bewerbung_Mustermann.pdf',
      fussName: 'Max Mustermann',
      teile: [{ art: 'pdf', daten: await quellPdf(['Eins']), abschnitt: 'Selbstauskunft' }],
      schriften: pdfSchriften(),
    });
    const geladen = await PDFDocument.load(ergebnis.bytes, { updateMetadata: false });
    expect(geladen.getTitle()).toBe('Bewerbung_Mustermann');
    expect(geladen.getProducer()).toBeUndefined();
    expect(geladen.getCreator()).toBeUndefined();
    expect(geladen.getAuthor()).toBeUndefined();
    const roh = new TextDecoder('latin1').decode(ergebnis.bytes);
    for (const wort of ['pdf-lib', 'cantoo', 'Lohnportal', 'Arbeitgeber GmbH', 'Mappe']) {
      expect(roh).not.toContain(wort);
    }
  });

  it('macht aus dem Dateinamen den Titel', () => {
    expect(titelAusDateiname('Bewerbung_Mustermann.pdf')).toBe('Bewerbung_Mustermann');
    expect(titelAusDateiname('Bewerbung_Mustermann.PDF')).toBe('Bewerbung_Mustermann');
  });
});

describe('Druckton der Personenfarben (mappe-pdf.md)', () => {
  it('ergibt die sechs Töne aus dem Design', () => {
    expect(PERSONENFARBEN.map(druckTon)).toEqual([
      '#a85c50',
      '#7c955e',
      '#8674af',
      '#967849',
      '#a8758d',
      '#866e66',
    ]);
  });
});
