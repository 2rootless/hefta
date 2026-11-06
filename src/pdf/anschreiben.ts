import fontkit from '@cantoo/fontkit';
import { PDFDocument, type PDFPage } from '@cantoo/pdf-lib';
import type { Anschreiben } from '../domain/anschreiben';
import { A4, FARBE, RAND, TYPO, fusszeile, titelAusDateiname, type Schriften } from './mappe';
import { umbrechen } from './selbstauskunft';

// Version 2, Anschreiben als PDF (docs/10-version-2.md, B6) im Stil der Mappe: Absender oben,
// Empfänger, Ort und Datum rechtsbündig, Betreff fett, Text mit Absätzen. Läuft ohne Browser-APIs.
// Gestaltung vorläufig, bis der Entwurf da ist.

export interface AnschreibenAuftrag {
  dateiname: string;
  /** Namen und Kontakt, je Zeile. */
  absender: string[];
  /** Ansprechpartner und Adresse, je Zeile (freiwillig). */
  empfaenger: string[];
  /** z. B. „Hamburg, 6. November 2026“. */
  ortDatum: string;
  anschreiben: Anschreiben;
  /** Für die Fußzeile, wie in der Mappe. */
  fussName: string;
  schriften: Schriften;
  datum?: Date;
}

export async function anschreibenBauen(
  a: AnschreibenAuftrag,
): Promise<{ bytes: Uint8Array; seiten: number }> {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.registerFontkit(fontkit);
  const s = {
    regular: await pdf.embedFont(a.schriften.regular, { subset: true }),
    bold: await pdf.embedFont(a.schriften.bold, { subset: true }),
  };
  const breite = A4.breite - 2 * RAND;
  const unten = RAND + 40;
  const { groesse, zeile } = { groesse: 12, zeile: 18 };
  let seite: PDFPage = pdf.addPage([A4.breite, A4.hoehe]);
  let y = A4.hoehe - 64;

  const schreiben = (text: string, fett = false, farbe = FARBE.ink) => {
    if (y < unten) {
      seite = pdf.addPage([A4.breite, A4.hoehe]);
      y = A4.hoehe - 64;
    }
    seite.drawText(text, {
      x: RAND,
      y,
      size: groesse,
      font: fett ? s.bold : s.regular,
      color: farbe,
    });
    y -= zeile;
  };

  for (const z of a.absender.filter(Boolean)) {
    seite.drawText(z, { x: RAND, y, size: TYPO.meta.groesse, font: s.regular, color: FARBE.muted });
    y -= TYPO.meta.zeile;
  }
  y -= 36;
  for (const z of a.empfaenger.filter(Boolean)) schreiben(z);
  y -= 24;
  const datumBreite = s.regular.widthOfTextAtSize(a.ortDatum, groesse);
  seite.drawText(a.ortDatum, {
    x: A4.breite - RAND - datumBreite,
    y,
    size: groesse,
    font: s.regular,
    color: FARBE.ink,
  });
  y -= zeile * 2;
  for (const z of umbrechen(a.anschreiben.betreff, s.bold, groesse, breite)) schreiben(z, true);
  y -= zeile;
  for (const z of umbrechen(a.anschreiben.text, s.regular, groesse, breite)) {
    if (z) schreiben(z);
    else y -= zeile;
  }

  const gesamt = pdf.getPageCount();
  pdf.getPages().forEach((p, i) => fusszeile(p, i + 1, gesamt, a.fussName, s.regular));
  const datum = a.datum ?? new Date();
  pdf.setTitle(titelAusDateiname(a.dateiname));
  pdf.setLanguage('de-DE');
  pdf.setCreationDate(datum);
  pdf.setModificationDate(datum);
  return { bytes: await pdf.save(), seiten: gesamt };
}
