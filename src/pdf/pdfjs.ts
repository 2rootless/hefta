import type { TextStueck } from '../domain/datumErkennen';
// Die Fassung für ältere Browser: Die normale verlangt ganz neue Funktionen (Chrome 140, Safari 18.2)
// und scheitert sonst schon beim Öffnen. Gefunden im Test der Android-App.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { canvasZuJpeg } from '../image/foto';
import { jpegMetadatenEntfernen } from '../image/jpegMetadaten';
import type { Bildquelle } from './bilderKleiner';
import './stromPolyfill';

// PDF.js nur mit lokal ausgelieferten Dateien: Worker, CMaps, Standardschriften, ICC, WebAssembly.
// Nichts wird von fremden Hosts geladen (die CSP würde es ohnehin blockieren).

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const basis = (pfad: string) => new URL(pfad, document.baseURI).href;

export type PdfDokument = pdfjs.PDFDocumentProxy;

export class PdfPasswortFehler extends Error {
  constructor(readonly falsch: boolean) {
    super(falsch ? 'Passwort falsch' : 'Passwort nötig');
  }
}

export async function pdfOeffnen(daten: Uint8Array, passwort?: string): Promise<PdfDokument> {
  const aufgabe = pdfjs.getDocument({
    data: daten.slice(),
    password: passwort,
    cMapUrl: basis('./pdfjs/cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: basis('./pdfjs/standard_fonts/'),
    iccUrl: basis('./pdfjs/iccs/'),
    wasmUrl: basis('./pdfjs/wasm/'),
    useSystemFonts: false,
    enableXfa: false,
  });
  try {
    return await aufgabe.promise;
  } catch (e) {
    if (e instanceof Error && e.name === 'PasswordException') {
      throw new PdfPasswortFehler((e as Error & { code?: number }).code === 2);
    }
    throw e;
  }
}

/** Rechteck in Anteilen der Seite (0 bis 1), von oben links. */
export interface Schwaerzung {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

/**
 * Rendert eine Seite als JPEG (Standard 200 dpi) und brennt Schwärzungen ein.
 * Ergebnis ist ein reines Bild: Text darunter lässt sich nicht mehr auslesen.
 */
export async function seiteRastern(
  dokument: PdfDokument,
  nummer: number,
  schwaerzungen: Schwaerzung[] = [],
  dpi = 200,
  qualitaet = 0.85,
  saeubern = false,
): Promise<{ jpeg: Uint8Array; breite: number; hoehe: number }> {
  const seite = await dokument.getPage(nummer);
  const ansicht = seite.getViewport({ scale: dpi / 72 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(ansicht.width);
  canvas.height = Math.floor(ansicht.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kein Canvas verfügbar');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await seite.render({ canvas, canvasContext: ctx, viewport: ansicht }).promise;
  ctx.fillStyle = '#000000';
  for (const s of schwaerzungen) {
    ctx.fillRect(
      s.x * canvas.width,
      s.y * canvas.height,
      s.breite * canvas.width,
      s.hoehe * canvas.height,
    );
  }
  if (saeubern) scanSaeubern(ctx, canvas.width, canvas.height);
  const jpeg = await canvasZuJpeg(canvas, qualitaet);
  const ergebnis = { jpeg, breite: canvas.width, hoehe: canvas.height };
  canvas.width = 0;
  canvas.height = 0;
  seite.cleanup();
  return ergebnis;
}

const SCAN_DPI = 150;
const SCAN_QUALITAET = 0.62;

/**
 * Ein Scan wird als JPEG viel kleiner, wenn das Papier wirklich weiß ist und Graustufen kein Farbrauschen
 * tragen. Die Schrift bleibt, wie sie ist. Fotos und bunte Seiten bleiben unangetastet.
 */
function scanSaeubern(ctx: CanvasRenderingContext2D, breite: number, hoehe: number): void {
  const bild = ctx.getImageData(0, 0, breite, hoehe);
  const d = bild.data;
  const haeufig = new Uint32Array(256);
  let bunt = 0;
  let stichprobe = 0;
  for (let i = 0; i < d.length; i += 28) {
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    if (Math.max(r, g, b) - Math.min(r, g, b) > 32) bunt++;
    const hell = (r * 77 + g * 150 + b * 29) >> 8;
    haeufig[hell] = haeufig[hell]! + 1;
    stichprobe++;
  }
  if (bunt / stichprobe > 0.05) return;
  // Der Papierton: der häufigste helle Wert. Gibt es keinen, ist es kein Blatt Papier.
  let papier = 255;
  let meist = 0;
  for (let v = 170; v < 256; v++) {
    if (haeufig[v]! > meist) {
      meist = haeufig[v]!;
      papier = v;
    }
  }
  if (meist / stichprobe < 0.15) return;
  const faktor = 255 / Math.max(170, papier - 8);
  const grau = bunt / stichprobe < 0.002;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    if (grau) {
      const v = Math.min(255, ((r * 77 + g * 150 + b * 29) >> 8) * faktor);
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    } else {
      d[i] = Math.min(255, r * faktor);
      d[i + 1] = Math.min(255, g * faktor);
      d[i + 2] = Math.min(255, b * faktor);
    }
  }
  ctx.putImageData(bild, 0, 0);
}

/** Ausschnitt einer Seite als Bild (0 bis 1, von links oben); gerendert wird nur dieser Teil. */
export async function seiteAusschnitt(
  dokument: PdfDokument,
  nummer: number,
  feld: { x: number; y: number; breite: number; hoehe: number },
  breitePx: number,
): Promise<string> {
  const seite = await dokument.getPage(nummer);
  const basis = seite.getViewport({ scale: 1 });
  const skala = breitePx / (feld.breite * basis.width);
  const ansicht = seite.getViewport({
    scale: skala,
    offsetX: -feld.x * basis.width * skala,
    offsetY: -feld.y * basis.height * skala,
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(breitePx);
  canvas.height = Math.round(feld.hoehe * basis.height * skala);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kein Canvas verfügbar');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await seite.render({ canvas, canvasContext: ctx, viewport: ansicht }).promise;
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
  canvas.width = 0;
  canvas.height = 0;
  seite.cleanup();
  if (!blob) throw new Error('Vorschau fehlgeschlagen');
  return URL.createObjectURL(blob);
}

/** Fast nichts auf der Seite: 99,5 % der Bildpunkte nahezu weiß, klein gerendert. */
export async function seiteFastWeiss(dokument: PdfDokument, nummer: number): Promise<boolean> {
  const seite = await dokument.getPage(nummer);
  const breite = seite.getViewport({ scale: 1 }).width;
  const ansicht = seite.getViewport({ scale: 100 / breite });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(ansicht.width);
  canvas.height = Math.ceil(ansicht.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await seite.render({ canvas, canvasContext: ctx, viewport: ansicht }).promise;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let dunkel = 0;
  for (let i = 0; i < data.length; i += 4)
    if (Math.min(data[i]!, data[i + 1]!, data[i + 2]!) < 240) dunkel++;
  seite.cleanup();
  return dunkel / (data.length / 4) < 0.005;
}

/** Auslesbarer Text einer Seite, wie ihn ein PDF-Programm beim Markieren findet. */
export async function seitenText(dokument: PdfDokument, nummer: number): Promise<string> {
  const inhalt = await (await dokument.getPage(nummer)).getTextContent();
  return inhalt.items
    .map((teil) => ('str' in teil ? teil.str : ''))
    .join(' ')
    .trim();
}

/** Gibt Speicher und Worker-Ressourcen eines Dokuments frei. */
export async function pdfSchliessen(dokument: PdfDokument): Promise<void> {
  // Schließen darf nie scheitern: Es läuft oft beim Verlassen einer Seite, während noch gerendert wird.
  await dokument.loadingTask.destroy().catch(() => {});
}

export { miniatur } from './miniatur';

/** Alle Seiten als Bilder (200 dpi) in ein neues PDF, Seitengröße wie im Original. */
export async function alsBilderPdf(dokument: PdfDokument): Promise<Uint8Array> {
  return gerastert(dokument, 200, 0.85);
}

/**
 * Verkleinern (D4, „Kleiner machen“ in X6, Version 2): gescannte Seiten mit weniger Auflösung und
 * stärkerer Kompression neu ablegen. Nur für PDFs ohne Text gedacht (`istGescannt`), sonst ginge
 * markierbarer Text verloren.
 */
export async function verkleinern(
  dokument: PdfDokument,
  { dpi = 150, qualitaet = 0.7 } = {},
): Promise<Uint8Array> {
  return gerastert(dokument, dpi, qualitaet);
}

/** Kein Text auf irgendeiner Seite: ein Scan oder Foto im PDF. */
export async function istGescannt(dokument: PdfDokument): Promise<boolean> {
  for (let n = 1; n <= dokument.numPages; n++)
    if ((await seitenText(dokument, n)).trim()) return false;
  return true;
}

/** Textstücke einer Seite mit ihrer Lage (0 bis 1, y von oben), um Daten darin zu finden. */
export async function seitenStuecke(dokument: PdfDokument, nummer: number): Promise<TextStueck[]> {
  const seite = await dokument.getPage(nummer);
  const ansicht = seite.getViewport({ scale: 1 });
  const inhalt = await seite.getTextContent();
  const stuecke: TextStueck[] = [];
  for (const teil of inhalt.items) {
    if (!('str' in teil) || !teil.str.trim()) continue;
    const [x, y] = ansicht.convertToViewportPoint(teil.transform[4], teil.transform[5]) as [
      number,
      number,
    ];
    const hoehe = Math.abs(teil.height || teil.transform[3]);
    stuecke.push({
      text: teil.str,
      x: x / ansicht.width,
      y: (y - hoehe) / ansicht.height,
      breite: teil.width / ansicht.width,
      hoehe: hoehe / ansicht.height,
    });
  }
  return stuecke;
}

/**
 * Seiten ohne Text (Scans, Fotos) einer Datei und wie groß eine davon verkleinert wird, gemessen an der
 * ersten und der letzten: Eine einzelne Probe könnte eine leere Rückseite sein.
 */
export async function scanProbe(
  daten: Uint8Array,
): Promise<{ bild: number; gesamt: number; kleinJeSeite: number }> {
  const dokument = await pdfOeffnen(daten);
  try {
    const gesamt = dokument.numPages;
    const ohneText: number[] = [];
    for (let n = 1; n <= gesamt; n++) if (!(await seitenText(dokument, n)).trim()) ohneText.push(n);
    if (!ohneText.length) return { bild: 0, gesamt, kleinJeSeite: 0 };
    const proben = [...new Set([ohneText[0]!, ohneText.at(-1)!])];
    let summe = 0;
    for (const n of proben)
      summe += (await seiteRastern(dokument, n, [], SCAN_DPI, SCAN_QUALITAET, true)).jpeg.length;
    return { bild: ohneText.length, gesamt, kleinJeSeite: summe / proben.length };
  } finally {
    await pdfSchliessen(dokument);
  }
}

/** Ein Bild aus dem PDF als kleineres JPEG. Null, wenn es sich nicht verlässlich lesen lässt. */
async function bildKodieren(
  quelle: Bildquelle,
): Promise<{ jpeg: Uint8Array; breite: number; hoehe: number } | null> {
  const { LANGE_KANTE, rohAlsRgba } = await import('./bilderKleiner');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (quelle.art === 'jpeg') {
    // PDF-Programme kennen keine EXIF-Drehung, der Browser schon: Ohne das stünde das Bild gedreht da.
    const blob = new Blob([jpegMetadatenEntfernen(quelle.daten) as Uint8Array<ArrayBuffer>], {
      type: 'image/jpeg',
    });
    const bitmap = await createImageBitmap(blob);
    if (bitmap.width !== quelle.breite || bitmap.height !== quelle.hoehe) {
      bitmap.close();
      return null;
    }
    const faktor = Math.min(1, LANGE_KANTE / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * faktor);
    canvas.height = Math.round(bitmap.height * faktor);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
  } else {
    const { pixel, breite, hoehe } = rohAlsRgba(quelle, LANGE_KANTE);
    canvas.width = breite;
    canvas.height = hoehe;
    ctx.putImageData(new ImageData(pixel, breite, hoehe), 0, 0);
  }
  // Groß ist vermutlich ein Scan; Fotos und bunte Bilder lässt das Säubern selbst in Ruhe.
  if (Math.max(canvas.width, canvas.height) >= 1000) scanSaeubern(ctx, canvas.width, canvas.height);
  const jpeg = await canvasZuJpeg(canvas, SCAN_QUALITAET);
  const ergebnis = { jpeg, breite: canvas.width, hoehe: canvas.height };
  canvas.width = 0;
  canvas.height = 0;
  return ergebnis;
}

/** Wie viel große Bilder in einer Datei ausmachen und wie klein sie werden (Seiten mit Text eingeschlossen). */
export async function bilderProbe(daten: Uint8Array): Promise<{ vorher: number; nachher: number }> {
  const { bilderSchaetzen } = await import('./bilderKleiner');
  return bilderSchaetzen(daten, bildKodieren);
}

/**
 * Seiten ohne Text werden neu und kleiner abgelegt (150 dpi, abgleich-produkt.md, zweite Runde, Frage 2).
 * Auf Seiten mit Text bleibt die Schrift, wie sie ist; dort werden nur große Bilder getauscht, auch bei
 * Scans mit Textschicht. Wird die Datei dadurch nicht kleiner, bleibt das Original.
 */
export async function gescannteVerkleinern(daten: Uint8Array): Promise<Uint8Array> {
  const { seitenErsetzen } = await import('./zusammenfuegen');
  const dokument = await pdfOeffnen(daten);
  const ersatz = new Map<number, { jpeg: Uint8Array; breitePt: number; hoehePt: number }>();
  for (let n = 1; n <= dokument.numPages; n++) {
    if ((await seitenText(dokument, n)).trim()) continue;
    const groesse = (await dokument.getPage(n)).getViewport({ scale: 1 });
    const { jpeg } = await seiteRastern(dokument, n, [], SCAN_DPI, SCAN_QUALITAET, true);
    ersatz.set(n - 1, { jpeg, breitePt: groesse.width, hoehePt: groesse.height });
  }
  await pdfSchliessen(dokument);
  const ohneBildseiten = ersatz.size ? await seitenErsetzen(daten, ersatz) : daten;
  const { bilderVerkleinern } = await import('./bilderKleiner');
  // Ein PDF, das sich so nicht bearbeiten lässt, ist kein Grund, die Mappe scheitern zu lassen.
  const neu = await bilderVerkleinern(ohneBildseiten, bildKodieren).catch(() => ohneBildseiten);
  return neu.length < daten.length ? neu : daten;
}

async function gerastert(dokument: PdfDokument, dpi: number, qualitaet: number) {
  const { bilderAlsPdf } = await import('./zusammenfuegen');
  const seiten = [];
  for (let n = 1; n <= dokument.numPages; n++) {
    const groesse = (await dokument.getPage(n)).getViewport({ scale: 1 });
    const { jpeg } = await seiteRastern(dokument, n, [], dpi, qualitaet);
    seiten.push({ jpeg, breitePt: groesse.width, hoehePt: groesse.height });
  }
  return bilderAlsPdf(seiten);
}
