import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';
import { testJpeg, textJeSeite } from '../test/hilfen';
import {
  bilderAlsPdf,
  pdfEntsperren,
  pdfsZusammenfuegen,
  seitenZahl,
  seitenZusammenfuegen,
} from './zusammenfuegen';

async function pdf(...texte: string[]) {
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  for (const t of texte)
    doc.addPage([595, 842]).drawText(t, { x: 50, y: 700, size: 14, font: schrift });
  return doc.save();
}

describe('PDFs fürs Hochladen', () => {
  it('fügt PDFs in Reihenfolge zusammen, Text bleibt erhalten', async () => {
    const ergebnis = await pdfsZusammenfuegen([
      await pdf('Seite A1', 'Seite A2'),
      await pdf('Seite B1'),
    ]);
    expect(await seitenZahl(ergebnis)).toBe(3);
    const text = await textJeSeite(ergebnis);
    expect(text[0]).toContain('A1');
    expect(text[1]).toContain('A2');
    expect(text[2]).toContain('B1');
  });

  it('ein einzelnes PDF bleibt byte-gleich', async () => {
    const eins = await pdf('Nur eins');
    expect(await pdfsZusammenfuegen([eins])).toBe(eins);
  });

  it('gerasterte Seiten ergeben ein PDF ohne auslesbaren Text', async () => {
    const ergebnis = await bilderAlsPdf([
      { jpeg: testJpeg(1654, 2339), breitePt: 595.28, hoehePt: 841.89 },
      { jpeg: testJpeg(2339, 1654), breitePt: 841.89, hoehePt: 595.28 },
    ]);
    expect(await seitenZahl(ergebnis)).toBe(2);
    expect((await textJeSeite(ergebnis)).join('')).toBe('');
    const geladen = await PDFDocument.load(ergebnis);
    expect(geladen.getPage(1).getSize()).toEqual({ width: 841.89, height: 595.28 });
  });

  it('entsperrt ein passwortgeschütztes PDF: Text bleibt, kein Passwort mehr nötig', async () => {
    const doc = await PDFDocument.create();
    const schrift = await doc.embedFont(StandardFonts.Helvetica);
    doc
      .addPage([595, 842])
      .drawText('Netto 2.450,00 EUR', { x: 50, y: 700, size: 14, font: schrift });
    doc.addPage([842, 595]).drawText('Seite zwei', { x: 50, y: 500, size: 14, font: schrift });
    doc.encrypt({ userPassword: 'geheim', ownerPassword: 'besitzer' });
    const geschuetzt = await doc.save();

    await expect(PDFDocument.load(geschuetzt)).rejects.toThrow();
    const offen = await pdfEntsperren(geschuetzt, 'geheim');
    const geladen = await PDFDocument.load(offen);
    expect(geladen.isEncrypted).toBe(false);
    expect(geladen.getPage(1).getSize()).toEqual({ width: 842, height: 595 });
    const text = await textJeSeite(offen);
    expect(text[0]).toContain('Netto 2.450,00 EUR');
    expect(text[1]).toContain('Seite zwei');
  });

  it('falsches Passwort: Entsperren scheitert', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.encrypt({ userPassword: 'geheim', ownerPassword: 'besitzer' });
    await expect(pdfEntsperren(await doc.save(), 'falsch')).rejects.toThrow();
  });
});

describe('Portal-PDFs ohne Passwort zum Öffnen', () => {
  async function geschuetzt(text: string) {
    const pdf = await PDFDocument.create();
    pdf.addPage([200, 200]).drawText(text);
    pdf.encrypt({ userPassword: '', ownerPassword: 'besitzer', permissions: { modifying: false } });
    return pdf.save();
  }

  it('lassen sich zusammenfügen, die Seiten sind danach unverschlüsselt', async () => {
    const zusammen = await pdfsZusammenfuegen([await geschuetzt('A'), await geschuetzt('B')]);
    const geladen = await PDFDocument.load(zusammen);
    expect(geladen.getPageCount()).toBe(2);
    expect(geladen.isEncrypted).toBe(false);
  });

  it('haben eine Seitenzahl', async () => {
    expect(await seitenZahl(await geschuetzt('A'))).toBe(1);
  });
});

describe('seitenZusammenfuegen', () => {
  it('nimmt genau die gewählten Seiten', async () => {
    const pdf = async (n: number) => {
      const doc = await PDFDocument.create();
      for (let i = 0; i < n; i++) doc.addPage();
      return doc.save();
    };
    const zusammen = await seitenZusammenfuegen([
      { daten: await pdf(3), seiten: [0, 2] },
      { daten: await pdf(2), seiten: [1] },
    ]);
    expect(await seitenZahl(zusammen)).toBe(3);
  });
});
