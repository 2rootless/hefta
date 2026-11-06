// Entwicklerwerkzeug: Beispiel-Dateien zum Ausprobieren auf dem Gerät (keine echten Unterlagen).
// Aufruf: node scripts/testdateien.mjs <zielordner>
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const ziel = process.argv[2];
if (!ziel) throw new Error('Zielordner fehlt');
mkdirSync(ziel, { recursive: true });

const PASSWORT = 'hefta123';

/** Ein PDF mit je einer Seite pro Eintrag; jede Seite sagt, dass sie nur ein Beispiel ist. */
async function textPdf(seiten, { passwort } = {}) {
  const doc = await PDFDocument.create();
  const fett = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  for (const { titel, zeilen } of seiten) {
    const seite = doc.addPage([595, 842]);
    seite.drawText(titel, { x: 60, y: 760, size: 24, font: fett, color: rgb(0.1, 0.1, 0.17) });
    zeilen.forEach((z, i) =>
      seite.drawText(z, {
        x: 60,
        y: 720 - i * 22,
        size: 13,
        font: normal,
        color: rgb(0.1, 0.1, 0.17),
      }),
    );
    seite.drawText('BEISPIEL · keine echte Unterlage · erzeugt zum Testen von Hefta', {
      x: 60,
      y: 60,
      size: 10,
      font: normal,
      color: rgb(0.45, 0.45, 0.5),
    });
  }
  if (passwort) doc.encrypt({ userPassword: passwort, ownerPassword: `${passwort}-besitzer` });
  return doc.save();
}

/** PNG wie ein gescanntes Blatt: helles Rauschen mit dunklen Zeilen, lässt sich kaum komprimieren. */
function scanPng(breite, hoehe, start) {
  const block = (art, daten) => {
    const inhalt = Buffer.concat([Buffer.from(art, 'latin1'), daten]);
    const laenge = Buffer.alloc(4);
    laenge.writeUInt32BE(daten.length);
    const pruefsumme = Buffer.alloc(4);
    pruefsumme.writeUInt32BE(crc32(inhalt));
    return Buffer.concat([laenge, inhalt, pruefsumme]);
  };
  const kopf = Buffer.alloc(13);
  kopf.writeUInt32BE(breite, 0);
  kopf.writeUInt32BE(hoehe, 4);
  kopf.set([8, 2, 0, 0, 0], 8);
  const zeilen = Buffer.alloc((breite * 3 + 1) * hoehe);
  let x = start;
  for (let y = 0; y < hoehe; y++) {
    const anfang = y * (breite * 3 + 1);
    const schrift = y > 120 && y % 60 < 14 && y < hoehe - 200;
    for (let i = 1; i <= breite * 3; i++) {
      x = (x * 1664525 + 1013904223) >>> 0;
      const spalte = (i - 1) / 3;
      const dunkel = schrift && spalte > 90 && spalte < breite - 90;
      zeilen[anfang + i] = (dunkel ? 40 : 200) + (x >>> 26);
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    block('IHDR', kopf),
    block('IDAT', deflateSync(zeilen, { level: 6 })),
    block('IEND', Buffer.alloc(0)),
  ]);
}

async function scanPdf(anzahl) {
  const doc = await PDFDocument.create();
  for (let n = 0; n < anzahl; n++) {
    const bild = await doc.embedPng(scanPng(1000, 1400, n + 1));
    doc.addPage([595, 842]).drawImage(bild, { x: 0, y: 0, width: 595, height: 842 });
  }
  return doc.save();
}

const bonitaet = {
  titel: 'Bonitätsauskunft',
  zeilen: [
    'Ausgestellt am 20. Oktober 2026',
    '',
    'Name: Max Mustermann',
    'Ergebnis: Beispieltext ohne Aussage',
  ],
};
const gehalt = (monat, jahr) => ({
  titel: `Gehaltsabrechnung ${monat} ${jahr}`,
  zeilen: ['Arbeitgeber: Beispiel GmbH', 'Name: Max Mustermann', 'Netto: Beispielbetrag'],
});

const dateien = {
  '1-Passwort-hefta123.pdf': await textPdf([bonitaet], { passwort: PASSWORT }),
  '2-Bonitaet-Datum-nachlesen.pdf': await textPdf([
    bonitaet,
    { titel: 'Seite 2', zeilen: ['Rückseite des Beispiels'] },
  ]),
  '3-Gehalt_2026-08.pdf': await textPdf([gehalt('August', 2026)]),
  '3-Gehalt_2026-09.pdf': await textPdf([gehalt('September', 2026)]),
  '3-Gehalt_Oktober_2026.pdf': await textPdf([gehalt('Oktober', 2026)]),
  '4-Zwoelf-Seiten.pdf': await textPdf(
    Array.from({ length: 12 }, (_, i) => ({
      titel: `Kontoauszug, Seite ${i + 1}`,
      zeilen: ['Beispieltext'],
    })),
  ),
  '5-Grosser-Scan.pdf': await scanPdf(3),
  '6-Kaputt.pdf': new TextEncoder().encode('Das ist kein PDF, nur eine umbenannte Textdatei.'),
};

for (const [name, daten] of Object.entries(dateien)) {
  writeFileSync(join(ziel, name), daten);
  console.log(name, Math.round(daten.length / 1024), 'KB');
}
