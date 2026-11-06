import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import type { Schriften } from '../pdf/mappe';

/** Die statischen Archivo-Schnitte für die PDF-Mappe, aus dem Repo gelesen. */
export function pdfSchriften(): Schriften {
  const ordner = join(import.meta.dirname, '..', 'pdf', 'fonts');
  return {
    regular: readFileSync(join(ordner, 'Archivo-Regular.ttf')),
    bold: readFileSync(join(ordner, 'Archivo-Bold.ttf')),
    titel: readFileSync(join(ordner, 'Archivo-ExtraBold-Wide.ttf')),
  };
}

/**
 * Kleinstes JPEG, das PDF-Bibliotheken einbetten: SOI, SOF0 mit Maßen, SOS, EOI.
 * Die Bilddaten werden nie dekodiert, darum genügt das Gerüst für Aufbau-Tests.
 */
export function testJpeg(breite: number, hoehe: number): Uint8Array {
  const sof = [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    hoehe >> 8,
    hoehe & 0xff,
    breite >> 8,
    breite & 0xff,
    0x03,
  ];
  const komponenten = [0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01];
  const sos = [0xff, 0xda, 0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00];
  return new Uint8Array([0xff, 0xd8, ...sof, ...komponenten, ...sos, 0x00, 0xff, 0xd9]);
}

/** Text je Seite, mit PDF.js ausgelesen (so wie ein Vermieter Text markieren oder suchen würde). */
export async function textJeSeite(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const schriftOrdner = join(
    import.meta.dirname,
    '..',
    '..',
    'node_modules',
    'pdfjs-dist',
    'standard_fonts',
  );
  const aufgabe = pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: false,
    standardFontDataUrl: schriftOrdner.split(sep).join('/') + '/',
  });
  const dokument = await aufgabe.promise;
  const seiten: string[] = [];
  for (let i = 1; i <= dokument.numPages; i++) {
    const inhalt = await (await dokument.getPage(i)).getTextContent();
    seiten.push(inhalt.items.map((teil) => ('str' in teil ? teil.str : '')).join(' '));
  }
  await aufgabe.destroy();
  return seiten;
}
