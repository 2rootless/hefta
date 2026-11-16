import { registerPlugin } from '@capacitor/core';
import type { Zeile } from './auswerten';

// Probe Vision gegen Tesseract (PC75): die beiden Wege, alles auf dem Gerät. Tesseract liegt im Probe-Bau unter
// /probe/ocr/ (Version 7.0.0 mit Kern 7.0.0, deutsches Modell, CP40), Vision ist der Baustein `HeftaProbe`
// (ios/App/App/HeftaNativPlugin.swift). Keine Verbindung nach außen.

interface HeftaProbePlugin {
  texterkennung(o: { bild: string; korrektur: boolean }): Promise<{
    zeilen: { text: string; sicherheit: number }[];
    ms: number;
  }>;
}
const HeftaProbe = registerPlugin<HeftaProbePlugin>('HeftaProbe');

/** Vision, Stufe „genau“, Deutsch. `korrektur`: mit Sprachkorrektur (für Text) oder ohne (für Zeilen unten). */
export async function visionLesen(
  bild: string,
  korrektur: boolean,
): Promise<{ zeilen: Zeile[]; ms: number }> {
  const t0 = performance.now();
  const r = await HeftaProbe.texterkennung({ bild, korrektur });
  return { zeilen: r.zeilen, ms: Math.round(r.ms || performance.now() - t0) };
}

interface TesseractZeile {
  text: string;
  confidence: number;
}
interface TesseractArbeiter {
  recognize(
    bild: HTMLCanvasElement,
    o: object,
    ausgabe: object,
  ): Promise<{ data: { blocks?: { paragraphs?: { lines?: TesseractZeile[] }[] }[] } }>;
  setParameters(p: Record<string, string>): Promise<unknown>;
}
interface TesseractGlobal {
  createWorker(
    sprache: string,
    oem: number,
    optionen: object,
    konfiguration?: Record<string, string>,
  ): Promise<TesseractArbeiter>;
}

let allgemein: TesseractArbeiter | null = null;
let zeilenUnten: TesseractArbeiter | null = null;

function skriptLaden(src: string): Promise<void> {
  return new Promise((fertig, fehler) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => fertig();
    s.onerror = () => fehler(new Error(`${src} fehlt`));
    document.head.append(s);
  });
}

/** Tesseract wie im Probelauf CP40: allgemein mit Wörterbuch, für die Zeilen unten nur die Zeichen der Norm. */
export async function tesseractStarten(): Promise<number> {
  const t0 = performance.now();
  if (!(window as unknown as { Tesseract?: TesseractGlobal }).Tesseract)
    await skriptLaden('/probe/ocr/tesseract.min.js');
  const T = (window as unknown as { Tesseract: TesseractGlobal }).Tesseract;
  const optionen = {
    workerPath: '/probe/ocr/worker.min.js',
    // Tesseract wählt im Ordner selbst die Fassung (relaxedsimd, simd oder ohne), je nachdem, was das Gerät kann.
    corePath: '/probe/ocr/core',
    langPath: '/probe/ocr/lang',
    gzip: false,
    cacheMethod: 'none',
    workerBlobURL: false,
  };
  allgemein ??= await T.createWorker('deu', 1, optionen);
  zeilenUnten ??= await T.createWorker('deu', 1, optionen, {
    load_system_dawg: '0',
    load_freq_dawg: '0',
  });
  await zeilenUnten.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
    tessedit_pageseg_mode: '6',
  });
  return Math.round(performance.now() - t0);
}

function zeilenAus(data: Awaited<ReturnType<TesseractArbeiter['recognize']>>['data']): Zeile[] {
  const aus: Zeile[] = [];
  for (const b of data.blocks ?? [])
    for (const p of b.paragraphs ?? [])
      for (const l of p.lines ?? []) {
        const text = l.text.trim();
        if (text) aus.push({ text, sicherheit: l.confidence / 100 });
      }
  return aus;
}

/**
 * Graustufen und Hintergrund ausgleichen wie im Probelauf CP40 („hell“): je Kachel von 32 px die hellen Werte
 * als Papier nehmen, glatt hochrechnen und das Bild dadurch teilen.
 */
function aufhellen(bild: HTMLImageElement): HTMLCanvasElement {
  const B = bild.naturalWidth;
  const H = bild.naturalHeight;
  const c = document.createElement('canvas');
  c.width = B;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(bild, 0, 0);
  const daten = g.getImageData(0, 0, B, H);
  const d = daten.data;
  const grau = new Float32Array(B * H);
  for (let i = 0, j = 0; j < grau.length; i += 4, j++)
    grau[j] = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
  const K = 32;
  const kb = Math.ceil(B / K);
  const kh = Math.ceil(H / K);
  const papier = new Float32Array(kb * kh);
  const werte: number[] = [];
  for (let ky = 0; ky < kh; ky++)
    for (let kx = 0; kx < kb; kx++) {
      werte.length = 0;
      for (let y = ky * K; y < Math.min(H, ky * K + K); y += 2)
        for (let x = kx * K; x < Math.min(B, kx * K + K); x += 2) werte.push(grau[y * B + x]!);
      werte.sort((p, q) => p - q);
      papier[ky * kb + kx] = Math.max(30, werte[Math.floor(werte.length * 0.9)]!);
    }
  const glatt = new Float32Array(kb * kh);
  for (let ky = 0; ky < kh; ky++)
    for (let kx = 0; kx < kb; kx++) {
      let m = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = Math.min(kh - 1, Math.max(0, ky + dy));
          const xx = Math.min(kb - 1, Math.max(0, kx + dx));
          m = Math.max(m, papier[yy * kb + xx]!);
        }
      glatt[ky * kb + kx] = m;
    }
  for (let y = 0; y < H; y++) {
    const fy = Math.min(kh - 1.001, Math.max(0, y / K - 0.5));
    const y0 = Math.floor(fy);
    const ay = fy - y0;
    for (let x = 0; x < B; x++) {
      const fx = Math.min(kb - 1.001, Math.max(0, x / K - 0.5));
      const x0 = Math.floor(fx);
      const ax = fx - x0;
      const p0 = glatt[y0 * kb + x0]! * (1 - ax) + glatt[y0 * kb + x0 + 1]! * ax;
      const p1 = glatt[(y0 + 1) * kb + x0]! * (1 - ax) + glatt[(y0 + 1) * kb + x0 + 1]! * ax;
      const p = p0 * (1 - ay) + p1 * ay;
      const v = Math.max(0, Math.min(255, (grau[y * B + x]! / p) * 255));
      const i = (y * B + x) * 4;
      const k = Math.max(0, Math.min(255, ((v - 40) / (235 - 40)) * 255));
      d[i] = d[i + 1] = d[i + 2] = k;
    }
  }
  g.putImageData(daten, 0, 0);
  return c;
}

/** Das untere Drittel, vergrößert: dort stehen die Zeilen unten (einfacher als die Suche aus CP40). */
function unten(c: HTMLCanvasElement): HTMLCanvasElement {
  const f = 1.5;
  const oben = Math.round(c.height * 0.6);
  const aus = document.createElement('canvas');
  aus.width = Math.round(c.width * f);
  aus.height = Math.round((c.height - oben) * f);
  const g = aus.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, aus.width, aus.height);
  g.drawImage(c, 0, oben, c.width, c.height - oben, 0, 0, aus.width, aus.height);
  return aus;
}

/**
 * Tesseract liest das ganze Foto; bei Fotos mit Zeilen unten liest ein zweiter Lauf das untere Stück dazu.
 * `oben` und `hell` gibt es für den dritten Lauf mit dem OCR-B-Modell zurück, damit er nicht noch einmal liest.
 */
export async function tesseractLesen(
  bild: HTMLImageElement,
  mitZeilenUnten: boolean,
): Promise<{
  zeilen: Zeile[];
  ms: number;
  oben: Zeile[];
  msOben: number;
  hell: HTMLCanvasElement;
}> {
  if (!allgemein || !zeilenUnten) throw new Error('Tesseract ist nicht gestartet');
  const t0 = performance.now();
  const hell = aufhellen(bild);
  const { data } = await allgemein.recognize(hell, {}, { blocks: true, text: true });
  const oben = zeilenAus(data);
  const msOben = Math.round(performance.now() - t0);
  const zeilen = [...oben];
  if (mitZeilenUnten) {
    const r = await zeilenUnten.recognize(unten(hell), {}, { blocks: true, text: true });
    zeilen.push(...zeilenAus(r.data));
  }
  return { zeilen, ms: Math.round(performance.now() - t0), oben, msOben, hell };
}

let ocrb: TesseractArbeiter | null = null;

/**
 * Dritter Lauf (PC77 E155/2): Die Zeilen unten liest das OCR-B-Modell `ocrb_int` (Shreeshrii/tessdata_ocrb,
 * Apache-2.0), der übrige Text bleibt der aus dem allgemeinen Lauf. Fehlt das Modell, meldet es einen Fehler.
 */
export async function ocrbLesen(
  hell: HTMLCanvasElement,
  oben: Zeile[],
  msOben: number,
): Promise<{ zeilen: Zeile[]; ms: number }> {
  const T = (window as unknown as { Tesseract: TesseractGlobal }).Tesseract;
  ocrb ??= await T.createWorker(
    'ocrb_int',
    1,
    {
      workerPath: '/probe/ocr/worker.min.js',
      corePath: '/probe/ocr/core',
      langPath: '/probe/ocr/lang',
      gzip: false,
      cacheMethod: 'none',
      workerBlobURL: false,
    },
    { load_system_dawg: '0', load_freq_dawg: '0' },
  );
  await ocrb.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
    tessedit_pageseg_mode: '6',
  });
  const t0 = performance.now();
  const r = await ocrb.recognize(unten(hell), {}, { blocks: true, text: true });
  return {
    zeilen: [...oben, ...zeilenAus(r.data)],
    ms: msOben + Math.round(performance.now() - t0),
  };
}
