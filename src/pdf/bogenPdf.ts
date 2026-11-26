import fontkit from '@cantoo/fontkit';
import { PDFDocument } from '@cantoo/pdf-lib';
import {
  bogenBloecke,
  bogenDateinamen,
  nameVon,
  type BogenPerson,
  type SelbstauskunftBoegen,
} from '../domain/bogen';
import { fusszeile, PERSONENFARBEN, titelAusDateiname, type Schriften } from './mappe';
import { selbstauskunftZeichnen, zeichenErsetzer } from './selbstauskunft';

// E111 (DP134, Abschnitt 4): das PDF aus dem Bogen im Browser. Jeder Bogen ist eine Seite, der Bogen der App ohne Rolle,
// ohne Lebenslage und ohne Frage 3. „Alle in einer PDF“: eine Datei, „Seite 1 von 2“, im Fuß Zeichen und Name der Person
// dieser Seite; „Je Person eine PDF“: je Person eine Datei. Läuft ohne Browser-APIs.

const TAG = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

async function datei(
  personen: BogenPerson[],
  b: SelbstauskunftBoegen,
  dateiname: string,
  schriften: Schriften,
  datum: Date,
): Promise<{ name: string; bytes: Uint8Array; seiten: string[] }> {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(schriften.regular, { subset: true });
  const s = {
    regular,
    bold: await pdf.embedFont(schriften.bold, { subset: true }),
    titel: await pdf.embedFont(schriften.titel, { subset: true }),
    ersetzen: zeichenErsetzer(regular),
  };
  const jetzt = datum.toISOString();
  const ortDatum = [b.hh.ort.trim(), TAG.format(datum)].filter(Boolean).join(', ');
  // Der Name der Person je Seite, für den Fuß.
  const namen: string[] = [];
  for (const p of personen) {
    const vorher = pdf.getPageCount();
    selbstauskunftZeichnen(pdf, s, {
      name: nameVon(p),
      rolle: '',
      ohneRolle: true,
      farbe: PERSONENFARBEN[(p.farbe - 1) % PERSONENFARBEN.length]!,
      bloecke: bogenBloecke(p, b.hh, jetzt),
      ortDatum,
      ortLabel: 'Ort, Datum',
    });
    for (let i = vorher; i < pdf.getPageCount(); i++) namen.push(nameVon(p));
  }
  const gesamt = pdf.getPageCount();
  pdf
    .getPages()
    .forEach((seite, i) => fusszeile(seite, i + 1, gesamt, s.ersetzen(namen[i] ?? ''), s.regular));
  pdf.setTitle(titelAusDateiname(dateiname));
  pdf.setLanguage('de-DE');
  pdf.setCreationDate(datum);
  pdf.setModificationDate(datum);
  return { name: dateiname, bytes: await pdf.save(), seiten: namen };
}

/** Die Dateien nach der Wahl „Alle in einer PDF“ oder „Je Person eine PDF“. */
export async function bogenPdfBauen(
  b: SelbstauskunftBoegen,
  schriften: Schriften,
  datum = new Date(),
): Promise<{ name: string; bytes: Uint8Array; seiten: string[] }[]> {
  const namen = bogenDateinamen(b);
  if (namen.length === 1 && b.personen.length > 1)
    return [await datei(b.personen, b, namen[0]!, schriften, datum)];
  return Promise.all(b.personen.map((p, i) => datei([p], b, namen[i]!, schriften, datum)));
}
