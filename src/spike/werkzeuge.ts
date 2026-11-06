import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { openDB } from 'idb';
import { canvasZuJpeg } from '../image/foto';
import { jpegMitTestExif } from '../image/jpegMetadaten';

// Hilfen nur für den Technik-Test (M0-Spike). Wird mit der Testseite vor Version 1 entfernt.

export { pdfSchriftenLaden } from '../pdf/schriften';

/**
 * Beispielfoto wie vom iPhone: 4032 × 3024 quer gespeichert, EXIF sagt „90° drehen“ (hochkant
 * aufgenommen) und enthält eine GPS-Position. Nach dem Aufbereiten muss es hochkant und ohne EXIF sein.
 */
export async function beispielFoto(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 4032;
  canvas.height = 3024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e9e4da';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(500, 300, 3000, 2400);
  ctx.fillStyle = '#191a2c';
  ctx.font = 'bold 140px sans-serif';
  // Gespeichert gedreht: Der Text steht erst nach Anwenden der EXIF-Ausrichtung aufrecht.
  ctx.save();
  ctx.translate(2000, 1500);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Gehaltsabrechnung', -700, 0);
  ctx.font = '90px sans-serif';
  ctx.fillText('Oktober 2026 · Beispiel', -700, 160);
  ctx.restore();
  const jpeg = await canvasZuJpeg(canvas, 0.9);
  canvas.width = 0;
  canvas.height = 0;
  return new Blob([jpegMitTestExif(jpeg, 6) as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' });
}

/**
 * Version 2 (D1): ein schräg fotografiertes Blatt auf einem Holztisch, 3024 × 4032 wie ein
 * iPhone-Foto. Die Ecken des Blatts stehen in `BEISPIEL_BLATT` (zum Prüfen der Erkennung).
 */
export const BEISPIEL_BLATT = [
  { x: 520, y: 610 },
  { x: 2590, y: 820 },
  { x: 2440, y: 3600 },
  { x: 330, y: 3420 },
];

export async function beispielSchraegesFoto(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 3024;
  canvas.height = 4032;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6b5440';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  BEISPIEL_BLATT.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = '#d9d4c8';
  ctx.fill();
  // Schrift in der Ebene des Blatts (grob: gedreht wie die Oberkante).
  ctx.save();
  ctx.translate(700, 900);
  ctx.rotate(Math.atan2(820 - 610, 2590 - 520));
  ctx.fillStyle = '#2a2a33';
  ctx.font = 'bold 110px sans-serif';
  ctx.fillText('Bonitätsauskunft', 0, 0);
  ctx.font = '70px sans-serif';
  for (let i = 0; i < 12; i++) ctx.fillText('Muster Muster Muster Muster Muster', 0, 200 + i * 110);
  ctx.restore();
  const jpeg = await canvasZuJpeg(canvas, 0.9);
  canvas.width = 0;
  canvas.height = 0;
  return new Blob([jpeg as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' });
}

/** Beispiel-PDF mit einer erfundenen Kontonummer, die geschwärzt werden soll. */
export async function beispielPdf(passwort?: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const schrift = await pdf.embedFont(StandardFonts.Helvetica);
  for (const [i, titel] of ['Kontoauszug (Beispiel)', 'Seite 2 (Beispiel)'].entries()) {
    const seite = pdf.addPage([595.28, 841.89]);
    seite.drawText(titel, { x: 60, y: 760, size: 20, font: schrift });
    seite.drawText('Gehalt Oktober 2026  2.450,00 EUR', { x: 60, y: 700, size: 12, font: schrift });
    if (i === 0) {
      seite.drawText('Kontonummer DE00 1234 5678 9012 3456 78', {
        x: 60,
        y: 600,
        size: 12,
        font: schrift,
      });
    }
  }
  if (passwort) pdf.encrypt({ userPassword: passwort, ownerPassword: `${passwort}-besitz` });
  return pdf.save();
}

/** Schwärzung für die Kontonummer im Beispiel-PDF (Anteile der Seite, von oben links). */
export const BEISPIEL_SCHWAERZUNG = { x: 0.08, y: 0.26, breite: 0.84, hoehe: 0.05 };

// ---------- Testdaten für Speicher und Backup ----------

const DB = 'hefta-technik-test';

function datenbank() {
  return openDB(DB, 1, {
    upgrade(db) {
      db.createObjectStore('dateien');
    },
  });
}

export async function pruefsumme(daten: Blob): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', await daten.arrayBuffer());
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Legt `megabyte` MB nicht komprimierbare Testdaten in Dateien zu je 5 MB ab (wie Fotos). */
export async function testdatenErzeugen(
  megabyte: number,
  fortschritt: (mb: number) => void,
): Promise<'blob' | 'arraybuffer'> {
  let art: 'blob' | 'arraybuffer' = 'blob';
  const db = await datenbank();
  await db.clear('dateien');
  const groesse = 5 * 1024 * 1024;
  for (let i = 0; i * 5 < megabyte; i++) {
    const daten = new Uint8Array(Math.min(groesse, (megabyte - i * 5) * 1024 * 1024));
    for (let pos = 0; pos < daten.length; pos += 65536) {
      crypto.getRandomValues(daten.subarray(pos, pos + 65536));
    }
    const blob = new Blob([daten], { type: 'image/jpeg' });
    const hash = await pruefsumme(blob);
    const name = `datei-${String(i).padStart(3, '0')}`;
    try {
      await db.put('dateien', { blob, hash }, name);
    } catch {
      // Manche Umgebungen (privates Surfen, WebKit im Test) speichern keine Blobs in IndexedDB.
      art = 'arraybuffer';
      await db.put('dateien', { puffer: daten.buffer, hash }, name);
    }
    fortschritt(Math.min(megabyte, (i + 1) * 5));
  }
  db.close();
  return art;
}

export async function testdatenListe(): Promise<{ name: string; blob: Blob; hash: string }[]> {
  const db = await datenbank();
  const namen = (await db.getAllKeys('dateien')) as string[];
  const liste = [];
  for (const name of namen) {
    const eintrag = (await db.get('dateien', name)) as {
      blob?: Blob;
      puffer?: ArrayBuffer;
      hash: string;
    };
    liste.push({ name, hash: eintrag.hash, blob: eintrag.blob ?? new Blob([eintrag.puffer!]) });
  }
  db.close();
  return liste;
}

export async function testdatenLoeschen(): Promise<void> {
  const db = await datenbank();
  await db.clear('dateien');
  db.close();
}

export function groesse(bytes: number): string {
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toLocaleString('de-DE', { maximumFractionDigits: 0 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
}

export function sekunden(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} s`;
}
