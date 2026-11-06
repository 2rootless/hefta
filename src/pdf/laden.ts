import { PDFDocument } from '@cantoo/pdf-lib';

/**
 * Lädt eine hochgeladene PDF. Banken und Lohnportale schützen viele PDFs nur gegen Ändern: Sie gehen
 * ohne Passwort auf, sind aber verschlüsselt. Ohne Entschlüsseln bricht das Übernehmen der Seiten ab,
 * darum immer mit dem leeren Passwort laden; unverschlüsselte Dateien bemerken davon nichts.
 */
export function pdfLaden(daten: Uint8Array, passwort = ''): Promise<PDFDocument> {
  return PDFDocument.load(daten, { password: passwort, updateMetadata: false });
}
