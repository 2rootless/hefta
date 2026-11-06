import { aufhellen } from './aufhellen';
import { eckenFinden } from './ecken';
import { entzerren, zielGroesse } from './entzerren';
import { jpegMetadatenEntfernen } from './jpegMetadaten';
import { ganzesBild, type Ecken, type Raster } from './raster';

// Foto-Aufbereitung beim Import (docs/05-dokument-pipeline.md): Ausrichtung aus EXIF anwenden,
// auf höchstens A4 bei 200 dpi verkleinern, als JPEG neu kodieren und Metadaten entfernen.
// Zuschneiden, Drehen und Kontrast kommen mit M3 dazu.

const LANG = 2339; // A4 lange Seite bei 200 dpi
const KURZ = 1654; // A4 kurze Seite bei 200 dpi
export const JPEG_QUALITAET = 0.82;

export interface AufbereitetesFoto {
  jpeg: Uint8Array;
  breite: number;
  hoehe: number;
}

type Bildquelle = ImageBitmap | HTMLImageElement;

async function laden(datei: Blob): Promise<Bildquelle> {
  try {
    return await createImageBitmap(datei, { imageOrientation: 'from-image' });
  } catch {
    // Manche Formate (z. B. HEIC in Safari) gehen nur über ein Bild-Element.
    const url = URL.createObjectURL(datei);
    try {
      const bild = new Image();
      bild.src = url;
      await bild.decode();
      return bild;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function masse(quelle: Bildquelle): { breite: number; hoehe: number } {
  return 'naturalWidth' in quelle
    ? { breite: quelle.naturalWidth, hoehe: quelle.naturalHeight }
    : { breite: quelle.width, hoehe: quelle.height };
}

export function canvasZuJpeg(
  canvas: HTMLCanvasElement,
  qualitaet = JPEG_QUALITAET,
): Promise<Uint8Array> {
  return new Promise((fertig, fehler) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return fehler(new Error('Bild konnte nicht gespeichert werden'));
        blob.arrayBuffer().then((b) => fertig(new Uint8Array(b)), fehler);
      },
      'image/jpeg',
      qualitaet,
    );
  });
}

export async function fotoAufbereiten(datei: Blob): Promise<AufbereitetesFoto> {
  const quelle = await laden(datei);
  const { breite, hoehe } = masse(quelle);
  const faktor = Math.min(1, LANG / Math.max(breite, hoehe), KURZ / Math.min(breite, hoehe));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(breite * faktor);
  canvas.height = Math.round(hoehe * faktor);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kein Canvas verfügbar');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(quelle, 0, 0, canvas.width, canvas.height);
  if ('close' in quelle) quelle.close();

  const jpeg = jpegMetadatenEntfernen(await canvasZuJpeg(canvas));
  const ergebnis = { jpeg, breite: canvas.width, hoehe: canvas.height };
  // Canvas sofort freigeben; Safari auf dem iPhone hat ein enges Gesamtlimit.
  canvas.width = 0;
  canvas.height = 0;
  return ergebnis;
}

// ---------- Version 2: Foto zur geraden Seite (design/zeit-und-dateien.md, D1, D1b) ----------

/** Foto als Pixel, Ausrichtung angewandt; die lange Seite höchstens `langeSeite` (Arbeitsspeicher). */
export async function fotoPixel(datei: Blob, langeSeite = 3000): Promise<ImageData> {
  const quelle = await laden(datei);
  const { breite, hoehe } = masse(quelle);
  const f = Math.min(1, langeSeite / Math.max(breite, hoehe));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(breite * f);
  canvas.height = Math.round(hoehe * f);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Kein Canvas verfügbar');
  ctx.drawImage(quelle, 0, 0, canvas.width, canvas.height);
  if ('close' in quelle) quelle.close();
  const pixel = ctx.getImageData(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;
  return pixel;
}

export async function pixelZuJpeg(bild: Raster): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = bild.width;
  canvas.height = bild.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Kein Canvas verfügbar');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(bild.data), bild.width, bild.height), 0, 0);
  const jpeg = jpegMetadatenEntfernen(await canvasZuJpeg(canvas));
  canvas.width = 0;
  canvas.height = 0;
  return jpeg;
}

export interface SeiteAusFoto extends AufbereitetesFoto {
  /** Die verwendeten Ecken im geladenen Foto (Ausgangslage für die Anfasser). */
  ecken: Ecken;
  /** Ob Ecken erkannt oder vorgegeben wurden (sonst liegen sie am Bildrand). */
  erkannt: boolean;
}

/** Gerade rücken, zuschneiden und aufhellen; ohne `ecken` werden sie gesucht. A4 bei 200 dpi. */
export async function seiteAusFoto(
  foto: Raster,
  { ecken, heller = true }: { ecken?: Ecken; heller?: boolean } = {},
): Promise<SeiteAusFoto> {
  const gefunden = ecken ?? eckenFinden(foto);
  const genutzt = gefunden ?? ganzesBild(foto.width, foto.height);
  let seite = entzerren(foto, genutzt, zielGroesse(genutzt, LANG));
  if (heller) seite = aufhellen(seite);
  return {
    jpeg: await pixelZuJpeg(seite),
    breite: seite.width,
    hoehe: seite.height,
    ecken: genutzt,
    erkannt: !!gefunden,
  };
}
