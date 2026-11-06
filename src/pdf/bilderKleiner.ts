import {
  decodePDFRawStream,
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFStream,
} from '@cantoo/pdf-lib';
import { pdfLaden } from './laden';

// Große Bilder in einem PDF kleiner machen, ohne die Seite anzufassen: Das Bild wird an Ort und Stelle
// getauscht, Text bleibt Text. So werden auch Scans mit Textschicht und Seiten mit einem Foto kleiner.
// Das Kodieren braucht ein Canvas und kommt von außen; alles andere läuft auch unter Node.

/** Darunter lohnt die Mühe nicht: Logos, Unterschriften. */
const KLEINSTE_DATEI = 100 * 1024;
/** Längere Bilder als A4 bei 150 dpi werden immer verkleinert. */
export const LANGE_KANTE = 1754;
/** Unter diesen Byte je Bildpunkt ist ein JPEG schon fest gepackt: Ein zweites Mal kostet nur Schärfe. */
const SCHON_FEST = 0.25;
/** Spart das neue Bild nicht wenigstens ein Fünftel, bleibt das alte. */
const MINDESTENS = 0.8;

export type Bildquelle =
  | { art: 'jpeg'; daten: Uint8Array; breite: number; hoehe: number }
  | { art: 'roh'; daten: Uint8Array; breite: number; hoehe: number; kanaele: 1 | 3 };

export type Bildkodierer = (
  quelle: Bildquelle,
) => Promise<{ jpeg: Uint8Array; breite: number; hoehe: number } | null>;

interface Kandidat {
  ref: PDFRef;
  strom: PDFRawStream;
  art: 'jpeg' | 'roh';
  breite: number;
  hoehe: number;
  kanaele: 1 | 3;
}

const n = (name: string) => PDFName.of(name);

function zahl(dict: PDFDict, schluessel: string, sonst = 0): number {
  const wert = dict.lookup(n(schluessel));
  return wert instanceof PDFNumber ? wert.asNumber() : sonst;
}

/** Nur Grau und RGB: CMYK, Palette und Lab sähen nach dem Tausch anders aus. */
function kanaeleAus(dict: PDFDict): 1 | 3 | null {
  const raum = dict.lookup(n('ColorSpace'));
  const art = raum instanceof PDFArray ? raum.lookup(0) : raum;
  if (art === n('DeviceGray') || art === n('CalGray')) return 1;
  if (art === n('DeviceRGB') || art === n('CalRGB')) return 3;
  if (art === n('ICCBased') && raum instanceof PDFArray) {
    const profil = raum.lookup(1);
    const anzahl = profil instanceof PDFStream ? zahl(profil.dict, 'N') : 0;
    if (anzahl === 1 || anzahl === 3) return anzahl;
  }
  return null;
}

function einzigerFilter(dict: PDFDict): PDFName | null {
  const filter = dict.lookup(n('Filter'));
  if (filter instanceof PDFName) return filter;
  if (filter instanceof PDFArray && filter.size() === 1) {
    const erster = filter.lookup(0);
    return erster instanceof PDFName ? erster : null;
  }
  return null;
}

function parameter(dict: PDFDict): PDFDict | null {
  const p = dict.lookup(n('DecodeParms'));
  if (p instanceof PDFDict) return p;
  if (p instanceof PDFArray && p.size() === 1) {
    const erster = p.lookup(0);
    return erster instanceof PDFDict ? erster : null;
  }
  return null;
}

/** Nur PNG-Prädiktoren mit genau den Maßen des Bildes; alles andere bleibt, wie es ist. */
function praediktorLesbar(dict: PDFDict, breite: number, kanaele: number): boolean {
  const p = parameter(dict);
  if (!p) return true;
  const art = zahl(p, 'Predictor', 1);
  if (art === 1) return true;
  return (
    art >= 10 &&
    zahl(p, 'Colors', 1) === kanaele &&
    zahl(p, 'BitsPerComponent', 8) === 8 &&
    zahl(p, 'Columns', 1) === breite
  );
}

function kandidatAus(ref: PDFRef, strom: PDFRawStream): Kandidat | null {
  const d = strom.dict;
  if (d.lookup(n('Subtype')) !== n('Image')) return null;
  const maske = d.lookup(n('ImageMask'));
  if (maske instanceof PDFBool && maske.asBoolean()) return null;
  // Umkehrung und Farbschlüssel hängen an den genauen Werten des Bildes: Nach JPEG stimmen sie nicht mehr.
  if (d.lookup(n('Decode')) || d.lookup(n('Mask')) instanceof PDFArray) return null;
  const breite = zahl(d, 'Width');
  const hoehe = zahl(d, 'Height');
  const kanaele = kanaeleAus(d);
  const groesse = strom.contents.length;
  if (!breite || !hoehe || !kanaele || groesse < KLEINSTE_DATEI) return null;
  const filter = einzigerFilter(d);
  if (filter === n('DCTDecode')) {
    const zuLang = Math.max(breite, hoehe) > LANGE_KANTE * 1.15;
    if (!zuLang && groesse / (breite * hoehe) < SCHON_FEST) return null;
    return { ref, strom, art: 'jpeg', breite, hoehe, kanaele };
  }
  if (filter === n('FlateDecode')) {
    if (zahl(d, 'BitsPerComponent') !== 8 || !praediktorLesbar(d, breite, kanaele)) return null;
    return { ref, strom, art: 'roh', breite, hoehe, kanaele };
  }
  return null;
}

/** Bilder, die sich lohnen. Masken bleiben: Man sieht sie nicht, und JPEG franst ihre Kanten aus. */
function bilderFinden(pdf: PDFDocument): Kandidat[] {
  const objekte = pdf.context.enumerateIndirectObjects();
  const masken = new Set<PDFRef>();
  for (const [, objekt] of objekte) {
    if (!(objekt instanceof PDFRawStream)) continue;
    for (const schluessel of ['SMask', 'Mask']) {
      const maske = objekt.dict.get(n(schluessel));
      if (maske instanceof PDFRef) masken.add(maske);
    }
  }
  const liste: Kandidat[] = [];
  for (const [ref, objekt] of objekte) {
    if (!(objekt instanceof PDFRawStream) || masken.has(ref)) continue;
    const kandidat = kandidatAus(ref, objekt);
    if (kandidat) liste.push(kandidat);
  }
  return liste;
}

/** Macht den PNG-Prädiktor rückgängig: Jede Zeile beginnt mit einem Byte, das ihre Rechnung nennt. */
export function pngZeilenAufheben(daten: Uint8Array, zeile: number, schritt: number): Uint8Array {
  const zeilen = Math.floor(daten.length / (zeile + 1));
  const aus = new Uint8Array(zeilen * zeile);
  for (let y = 0; y < zeilen; y++) {
    const von = y * (zeile + 1);
    const art = daten[von]!;
    const nach = y * zeile;
    for (let x = 0; x < zeile; x++) {
      const roh = daten[von + 1 + x]!;
      const links = x >= schritt ? aus[nach + x - schritt]! : 0;
      const oben = y > 0 ? aus[nach - zeile + x]! : 0;
      const oL = y > 0 && x >= schritt ? aus[nach - zeile + x - schritt]! : 0;
      let wert = roh;
      if (art === 1) wert = roh + links;
      else if (art === 2) wert = roh + oben;
      else if (art === 3) wert = roh + ((links + oben) >> 1);
      else if (art === 4) {
        const p = links + oben - oL;
        const a = Math.abs(p - links);
        const b = Math.abs(p - oben);
        const c = Math.abs(p - oL);
        wert = roh + (a <= b && a <= c ? links : b <= c ? oben : oL);
      }
      aus[nach + x] = wert & 255;
    }
  }
  return aus;
}

function quelleAus(k: Kandidat): Bildquelle | null {
  const { breite, hoehe, kanaele } = k;
  if (k.art === 'jpeg') return { art: 'jpeg', daten: k.strom.contents, breite, hoehe };
  const entpackt = decodePDFRawStream(k.strom).decode();
  const p = parameter(k.strom.dict);
  const zeile = breite * kanaele;
  const daten =
    p && zahl(p, 'Predictor', 1) >= 10 ? pngZeilenAufheben(entpackt, zeile, kanaele) : entpackt;
  if (daten.length < zeile * hoehe) return null;
  return { art: 'roh', daten, breite, hoehe, kanaele };
}

/**
 * Bildpunkte als RGBA, höchstens `langeKante` lang. Immer ganze Vielfache: So bleibt die Rechnung ein
 * einfacher Mittelwert, und es braucht nie ein Canvas in voller Größe (iOS begrenzt dessen Fläche).
 */
export function rohAlsRgba(
  quelle: { daten: Uint8Array; breite: number; hoehe: number; kanaele: 1 | 3 },
  langeKante: number,
): { pixel: Uint8ClampedArray<ArrayBuffer>; breite: number; hoehe: number } {
  const { daten, kanaele } = quelle;
  const schritt = Math.max(1, Math.ceil(Math.max(quelle.breite, quelle.hoehe) / langeKante));
  const breite = Math.max(1, Math.floor(quelle.breite / schritt));
  const hoehe = Math.max(1, Math.floor(quelle.hoehe / schritt));
  const pixel = new Uint8ClampedArray(breite * hoehe * 4);
  const zeile = quelle.breite * kanaele;
  // Ein sehr schmales Bild ist kürzer als der Schritt: Dann zählen nur die Punkte, die es gibt.
  const hochJe = Math.min(schritt, quelle.hoehe);
  const breitJe = Math.min(schritt, quelle.breite);
  const flaeche = hochJe * breitJe;
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < hochJe; dy++) {
        const start = (y * schritt + dy) * zeile + x * schritt * kanaele;
        for (let dx = 0; dx < breitJe; dx++) {
          const i = start + dx * kanaele;
          r += daten[i]!;
          g += daten[kanaele === 3 ? i + 1 : i]!;
          b += daten[kanaele === 3 ? i + 2 : i]!;
        }
      }
      const ziel = (y * breite + x) * 4;
      pixel[ziel] = r / flaeche;
      pixel[ziel + 1] = g / flaeche;
      pixel[ziel + 2] = b / flaeche;
      pixel[ziel + 3] = 255;
    }
  }
  return { pixel, breite, hoehe };
}

async function bildTauschen(
  pdf: PDFDocument,
  k: Kandidat,
  kodieren: Bildkodierer,
): Promise<boolean> {
  const quelle = quelleAus(k);
  const neu = quelle && (await kodieren(quelle));
  if (!neu || neu.jpeg.length > k.strom.contents.length * MINDESTENS) return false;
  const d = k.strom.dict;
  d.set(n('Filter'), n('DCTDecode'));
  d.delete(n('DecodeParms'));
  d.set(n('Width'), PDFNumber.of(neu.breite));
  d.set(n('Height'), PDFNumber.of(neu.hoehe));
  d.set(n('BitsPerComponent'), PDFNumber.of(8));
  d.set(n('ColorSpace'), n('DeviceRGB'));
  pdf.context.assign(k.ref, PDFRawStream.of(d, neu.jpeg));
  return true;
}

/**
 * Nur die Seiten, wie überall beim Bau der Mappe: Ein geschütztes PDF bliebe sonst geschützt, und Reste
 * früherer Fassungen, die an keiner Seite hängen, zählten mit.
 */
async function nurDieSeiten(quelle: PDFDocument): Promise<PDFDocument> {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  for (const seite of await pdf.copyPages(quelle, quelle.getPageIndices())) pdf.addPage(seite);
  return pdf;
}

/**
 * Tauscht große Bilder gegen kleinere, die Seiten bleiben wie sie sind. Ein Bild, das sich nicht lesen
 * lässt, bleibt einfach, wie es ist.
 */
export async function bilderVerkleinern(
  daten: Uint8Array,
  kodieren: Bildkodierer,
): Promise<Uint8Array> {
  const quelle = await pdfLaden(daten);
  if (!bilderFinden(quelle).length) return daten;
  const pdf = await nurDieSeiten(quelle);
  let geaendert = false;
  for (const kandidat of bilderFinden(pdf)) {
    try {
      if (await bildTauschen(pdf, kandidat, kodieren)) geaendert = true;
    } catch {
      // Bleibt, wie es ist.
    }
  }
  return geaendert ? pdf.save() : daten;
}

/** Wie viel Bild steckt in der Datei und wie klein wird es? Gemessen am größten und am kleinsten. */
export async function bilderSchaetzen(
  daten: Uint8Array,
  kodieren: Bildkodierer,
): Promise<{ vorher: number; nachher: number }> {
  const alle = bilderFinden(await nurDieSeiten(await pdfLaden(daten))).sort(
    (a, b) => b.strom.contents.length - a.strom.contents.length,
  );
  let probeVorher = 0;
  let probeNachher = 0;
  for (const k of new Set([alle[0], alle.at(-1)])) {
    if (!k) continue;
    try {
      const quelle = quelleAus(k);
      const neu = quelle && (await kodieren(quelle));
      if (!neu) continue;
      probeVorher += k.strom.contents.length;
      probeNachher += Math.min(neu.jpeg.length, k.strom.contents.length);
    } catch {
      // Zählt nicht mit.
    }
  }
  if (!probeVorher) return { vorher: 0, nachher: 0 };
  const vorher = alle.reduce((summe, k) => summe + k.strom.contents.length, 0);
  return { vorher, nachher: (vorher * probeNachher) / probeVorher };
}
