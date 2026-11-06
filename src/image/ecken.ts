import { helligkeit, verkleinern, type Ecken, type Raster } from './raster';

// Kanten finden (D1): helles Blatt auf dunklerem Grund. Klein rechnen, Schwelle nach Otsu,
// größte zusammenhängende helle Fläche, davon die vier äußersten Punkte. Kein Ersatz für die
// Anfasser: Klappt es nicht, kommt null zurück und die Ecken liegen am Bildrand.

const ERKENNUNG = 256;

function otsu(werte: Uint8Array): number {
  const histogramm = new Array<number>(256).fill(0);
  for (const v of werte) histogramm[v]!++;
  const n = werte.length;
  let summe = 0;
  for (let v = 0; v < 256; v++) summe += v * histogramm[v]!;
  let summeHinten = 0;
  let gewichtHinten = 0;
  let beste = 0;
  let schwelle = 127;
  for (let v = 0; v < 256; v++) {
    gewichtHinten += histogramm[v]!;
    if (!gewichtHinten) continue;
    const gewichtVorn = n - gewichtHinten;
    if (!gewichtVorn) break;
    summeHinten += v * histogramm[v]!;
    const mittelHinten = summeHinten / gewichtHinten;
    const mittelVorn = (summe - summeHinten) / gewichtVorn;
    const streuung = gewichtHinten * gewichtVorn * (mittelHinten - mittelVorn) ** 2;
    if (streuung > beste) {
      beste = streuung;
      schwelle = v;
    }
  }
  return schwelle;
}

export function eckenFinden(foto: Raster): Ecken | null {
  const klein = verkleinern(foto, ERKENNUNG);
  const { width: b, height: h, data } = klein;
  const grau = new Uint8Array(b * h);
  for (let i = 0; i < b * h; i++)
    grau[i] = helligkeit(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!);
  const schwelle = otsu(grau);

  // Größte helle Fläche (4er-Nachbarschaft).
  const marke = new Int32Array(b * h).fill(-1);
  let groesste: number[] = [];
  const stapel: number[] = [];
  for (let start = 0; start < b * h; start++) {
    if (marke[start] !== -1 || grau[start]! <= schwelle) continue;
    const flaeche: number[] = [];
    marke[start] = start;
    stapel.push(start);
    while (stapel.length) {
      const i = stapel.pop()!;
      flaeche.push(i);
      const x = i % b;
      const nachbarn = [i - b, i + b, x > 0 ? i - 1 : -1, x < b - 1 ? i + 1 : -1];
      for (const j of nachbarn)
        if (j >= 0 && j < b * h && marke[j] === -1 && grau[j]! > schwelle) {
          marke[j] = start;
          stapel.push(j);
        }
    }
    if (flaeche.length > groesste.length) groesste = flaeche;
  }

  // Zu klein (kein Blatt) oder fast das ganze Bild (kein Rand zu sehen): nichts erkannt.
  const anteil = groesste.length / (b * h);
  if (anteil < 0.15 || anteil > 0.97) return null;

  // Äußerste Punkte je Richtung: oben links kleinstes x+y, oben rechts größtes x−y usw.
  const wert = (i: number) => ({ x: i % b, y: Math.floor(i / b) });
  const richtungen = [
    (x: number, y: number) => -(x + y),
    (x: number, y: number) => x - y,
    (x: number, y: number) => x + y,
    (x: number, y: number) => y - x,
  ];
  const beste = richtungen.map(() => ({ i: groesste[0]!, wert: -Infinity }));
  for (const i of groesste) {
    const { x, y } = wert(i);
    richtungen.forEach((f, k) => {
      const v = f(x, y);
      if (v > beste[k]!.wert) beste[k] = { i, wert: v };
    });
  }
  const [ol, or, ur, ul] = beste.map((x) => x.i) as [number, number, number, number];
  const fx = foto.width / b;
  const fy = foto.height / h;
  // Pixelmitte bzw. Außenkante: rechte und untere Ecken eine Zelle weiter.
  return [
    { x: wert(ol).x * fx, y: wert(ol).y * fy },
    { x: (wert(or).x + 1) * fx, y: wert(or).y * fy },
    { x: (wert(ur).x + 1) * fx, y: (wert(ur).y + 1) * fy },
    { x: wert(ul).x * fx, y: (wert(ul).y + 1) * fy },
  ];
}
