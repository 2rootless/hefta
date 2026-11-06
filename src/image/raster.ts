// Bildverarbeitung für Fotos von Unterlagen (Version 2, design/zeit-und-dateien.md D1, D1b):
// Ecken finden, gerade rücken, aufhellen, drehen. Alles auf dem Gerät, ohne Bibliothek, auf
// RGBA-Pixeln wie in ImageData. Reine Funktionen, damit sie ohne Browser testbar sind.

/** RGBA-Pixel wie ImageData (ein ImageData passt direkt). */
export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface Punkt {
  x: number;
  y: number;
}

/** Vier Ecken einer Seite: oben links, oben rechts, unten rechts, unten links. */
export type Ecken = [Punkt, Punkt, Punkt, Punkt];

export function leeresRaster(width: number, height: number): Raster {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/** Helligkeit 0–255 nach Rec. 601, ganzzahlig. */
export function helligkeit(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/** Das ganze Bild als Ecken (Ausgangslage, wenn nichts erkannt wurde). */
export function ganzesBild(width: number, height: number): Ecken {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}

/** Um 90° im Uhrzeigersinn drehen (Werkzeug „Drehen“, D1b). */
export function drehen(bild: Raster): Raster {
  const { width: b, height: h, data } = bild;
  const ziel = leeresRaster(h, b);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < b; x++) {
      const von = (y * b + x) * 4;
      const nach = (x * h + (h - 1 - y)) * 4;
      ziel.data[nach] = data[von]!;
      ziel.data[nach + 1] = data[von + 1]!;
      ziel.data[nach + 2] = data[von + 2]!;
      ziel.data[nach + 3] = data[von + 3]!;
    }
  return ziel;
}

/** Verkleinern durch Mitteln (für die Erkennung und für Speicher-schonende Vorschauen). */
export function verkleinern(bild: Raster, langeSeite: number): Raster {
  const faktor = Math.max(bild.width, bild.height) / langeSeite;
  if (faktor <= 1) return bild;
  const b = Math.max(1, Math.round(bild.width / faktor));
  const h = Math.max(1, Math.round(bild.height / faktor));
  const ziel = leeresRaster(b, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < b; x++) {
      const x0 = Math.floor((x * bild.width) / b);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * bild.width) / b));
      const y0 = Math.floor((y * bild.height) / h);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * bild.height) / h));
      const summe = [0, 0, 0, 0];
      for (let yy = y0; yy < y1; yy++)
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * bild.width + xx) * 4;
          for (let k = 0; k < 4; k++) summe[k]! += bild.data[i + k]!;
        }
      const n = (x1 - x0) * (y1 - y0);
      const i = (y * b + x) * 4;
      for (let k = 0; k < 4; k++) ziel.data[i + k] = summe[k]! / n;
    }
  return ziel;
}
