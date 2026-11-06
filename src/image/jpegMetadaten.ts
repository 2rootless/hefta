// Entfernt Metadaten aus JPEG-Dateien: EXIF (mit GPS, Kamera, Zeit), XMP, IPTC und Kommentare.
// Behalten werden nur Segmente ohne persönliche Angaben, die für die Darstellung nötig sind:
// APP0 (JFIF), APP2 nur als ICC-Farbprofil, APP14 (Adobe-Farbumwandlung).
// Läuft nach jedem Neu-Kodieren eines Fotos, auch wenn der Canvas schon keine EXIF-Daten schreibt.

const SOI = 0xd8;
const SOS = 0xda;
const EOI = 0xd9;

function ohneLaenge(marker: number): boolean {
  return marker === SOI || marker === EOI || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

function beginntMit(daten: Uint8Array, start: number, text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (daten[start + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

function behalten(marker: number, daten: Uint8Array, inhalt: number): boolean {
  if (marker === 0xe0) return true; // APP0 JFIF
  if (marker === 0xe2) return beginntMit(daten, inhalt, 'ICC_PROFILE\0');
  if (marker === 0xee) return beginntMit(daten, inhalt, 'Adobe');
  if (marker >= 0xe1 && marker <= 0xef) return false; // EXIF, XMP, IPTC, Hersteller-Daten
  if (marker === 0xfe) return false; // Kommentar
  return true; // Tabellen, Bildaufbau
}

interface Segment {
  marker: number;
  start: number;
  ende: number;
  inhalt: number;
}

/** Segmente vor dem ersten Scan; `rest` ist der Beginn von SOS (Bilddaten bis zum Ende). */
function segmente(daten: Uint8Array): { liste: Segment[]; rest: number } {
  if (daten[0] !== 0xff || daten[1] !== SOI) throw new Error('Keine JPEG-Datei');
  const liste: Segment[] = [];
  let pos = 2;
  while (pos < daten.length) {
    if (daten[pos] !== 0xff) throw new Error('JPEG-Datei ist beschädigt');
    let marker = daten[pos + 1] ?? 0;
    while (marker === 0xff) {
      pos++;
      marker = daten[pos + 1] ?? 0;
    }
    if (marker === SOS) return { liste, rest: pos };
    if (ohneLaenge(marker)) {
      liste.push({ marker, start: pos, ende: pos + 2, inhalt: pos + 2 });
      pos += 2;
      continue;
    }
    const laenge = ((daten[pos + 2] ?? 0) << 8) | (daten[pos + 3] ?? 0);
    const ende = pos + 2 + laenge;
    if (laenge < 2 || ende > daten.length) throw new Error('JPEG-Datei ist beschädigt');
    liste.push({ marker, start: pos, ende, inhalt: pos + 4 });
    pos = ende;
  }
  return { liste, rest: daten.length };
}

/** Gibt eine Kopie ohne EXIF/GPS, XMP, IPTC und Kommentare zurück. */
export function jpegMetadatenEntfernen(daten: Uint8Array): Uint8Array {
  const { liste, rest } = segmente(daten);
  const teile: Uint8Array[] = [daten.subarray(0, 2)];
  for (const s of liste) {
    if (behalten(s.marker, daten, s.inhalt)) teile.push(daten.subarray(s.start, s.ende));
  }
  teile.push(daten.subarray(rest));
  const laenge = teile.reduce((summe, teil) => summe + teil.length, 0);
  const ergebnis = new Uint8Array(laenge);
  let pos = 0;
  for (const teil of teile) {
    ergebnis.set(teil, pos);
    pos += teil.length;
  }
  return ergebnis;
}

/** True, wenn die Datei EXIF- oder XMP-Daten enthält (dort stehen GPS, Kamera und Zeit). */
export function jpegHatMetadaten(daten: Uint8Array): boolean {
  return segmente(daten).liste.some(
    (s) =>
      (s.marker === 0xe1 &&
        (beginntMit(daten, s.inhalt, 'Exif\0') ||
          beginntMit(daten, s.inhalt, 'http://ns.adobe.com/'))) ||
      s.marker === 0xed ||
      s.marker === 0xfe,
  );
}

/**
 * Fügt einen EXIF-Block mit Ausrichtung und GPS-Position ein. Nur für Tests und den Technik-Test,
 * um zu prüfen, dass solche Daten beim Speichern verschwinden.
 */
export function jpegMitTestExif(daten: Uint8Array, ausrichtung = 1): Uint8Array {
  // TIFF, Little Endian. IFD0: Orientation (0x0112) und GPS-Zeiger (0x8825). GPS-IFD: Breite N 53°.
  const tiff = new Uint8Array(88);
  const v = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49, 0x2a, 0x00], 0);
  v.setUint32(4, 8, true);
  v.setUint16(8, 2, true); // zwei Einträge
  v.setUint16(10, 0x0112, true);
  v.setUint16(12, 3, true);
  v.setUint32(14, 1, true);
  v.setUint16(18, ausrichtung, true);
  v.setUint16(22, 0x8825, true);
  v.setUint16(24, 4, true);
  v.setUint32(26, 1, true);
  v.setUint32(30, 38, true); // GPS-IFD bei 38
  v.setUint32(34, 0, true);
  v.setUint16(38, 2, true); // GPS: zwei Einträge
  v.setUint16(40, 0x0001, true); // GPSLatitudeRef
  v.setUint16(42, 2, true);
  v.setUint32(44, 2, true);
  tiff.set([0x4e, 0x00], 48); // "N"
  v.setUint16(52, 0x0002, true); // GPSLatitude
  v.setUint16(54, 5, true);
  v.setUint32(56, 3, true);
  v.setUint32(60, 64, true);
  v.setUint32(64, 0, true);
  for (const [i, wert] of [53, 33, 0].entries()) {
    v.setUint32(64 + i * 8, wert, true);
    v.setUint32(68 + i * 8, 1, true);
  }
  const kopf = new TextEncoder().encode('Exif\0\0');
  const laenge = 2 + kopf.length + tiff.length;
  const app1 = new Uint8Array(2 + laenge);
  app1.set([0xff, 0xe1, laenge >> 8, laenge & 0xff], 0);
  app1.set(kopf, 4);
  app1.set(tiff, 4 + kopf.length);
  const ergebnis = new Uint8Array(daten.length + app1.length);
  ergebnis.set(daten.subarray(0, 2), 0);
  ergebnis.set(app1, 2);
  ergebnis.set(daten.subarray(2), 2 + app1.length);
  return ergebnis;
}
