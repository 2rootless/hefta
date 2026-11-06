import { helligkeit, leeresRaster, type Raster } from './raster';

// „Heller“ (D1): Papier soll weiß, Schrift dunkel werden, ohne Farben zu verfälschen. Die
// hellsten und dunkelsten 2 % zählen nicht (Glanzlicht, Schatten am Rand).

function perzentil(histogramm: number[], gesamt: number, anteil: number): number {
  let summe = 0;
  for (let v = 0; v < 256; v++) {
    summe += histogramm[v]!;
    if (summe >= gesamt * anteil) return v;
  }
  return 255;
}

export function aufhellen(bild: Raster, { graustufen = false } = {}): Raster {
  const { data } = bild;
  const histogramm = new Array<number>(256).fill(0);
  const n = bild.width * bild.height;
  for (let i = 0; i < data.length; i += 4)
    histogramm[Math.round(helligkeit(data[i]!, data[i + 1]!, data[i + 2]!))]!++;
  const schwarz = perzentil(histogramm, n, 0.02);
  const weiss = perzentil(histogramm, n, 0.98);
  // Fast einfarbige Bilder (leere Seite) nicht aufblasen.
  const spanne = Math.max(weiss - schwarz, 32);
  const aus = leeresRaster(bild.width, bild.height);
  for (let i = 0; i < data.length; i += 4) {
    const werte = graustufen
      ? Array(3).fill(helligkeit(data[i]!, data[i + 1]!, data[i + 2]!))
      : [data[i]!, data[i + 1]!, data[i + 2]!];
    for (let k = 0; k < 3; k++) aus.data[i + k] = ((werte[k]! - schwarz) * 255) / spanne;
    aus.data[i + 3] = data[i + 3]!;
  }
  return aus;
}
