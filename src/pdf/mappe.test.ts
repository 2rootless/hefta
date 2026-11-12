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

describe('Druckton der Personenfarben (B14, Fassung 3)', () => {
  it('ergibt die zwölf Drucktöne der Palette, nach Nummer', () => {
    expect(PERSONENFARBEN.map(druckTon)).toEqual([
      '#956f4d',
      '#727b4e',
      '#7d728b',
      '#86754c',
      '#996977',
      '#826c5e',
      '#65628e',
      '#597d73',
      '#366f72',
      '#895772',
      '#4e708e',
      '#5e7a8b',
    ]);
  });

  it('jeder Druckton hat auf Weiß und auf dem warmen Grund mindestens 3 : 1 (P34)', () => {
    const lum = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      const k = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * k[0]! + 0.7152 * k[1]! + 0.0722 * k[2]!;
    };
    const kontrast = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x! + 0.05) / (y! + 0.05);
    };
    for (const farbe of PERSONENFARBEN)
      for (const grund of ['#ffffff', '#faf6ef', '#efe6d8'])
        expect(kontrast(druckTon(farbe), grund)).toBeGreaterThanOrEqual(3);
  });
});
