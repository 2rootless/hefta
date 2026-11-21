// Messungen am App-Symbol für den Prüfkatalog SY aus DP111 (PC178): Geometrie der Klammer aus dem SVG, Bilder aus
// den gelieferten PNG. Nachbau von Designs luecke118.py und pruef118.py ohne scipy und rsvg: Die Mittellinie der Lücke
// kommt hier aus dem Pfad der Klammer selbst, nicht aus einem Skelett im Bild.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/** Ein Bild mit 3 Byte je Pixel (RGB). */
export type Bild = { breite: number; hoehe: number; rgb: Uint8Array };

/** Liest ein PNG mit 8 Bit RGB ohne Zeilensprung, so wie Design und Xcode es für das App-Symbol liefern. */
export function pngLesen(pfad: string): Bild {
  const b = readFileSync(pfad);
  let pos = 8;
  let breite = 0;
  let hoehe = 0;
  const idat: Buffer[] = [];
  while (pos < b.length) {
    const laenge = b.readUInt32BE(pos);
    const art = b.toString('latin1', pos + 4, pos + 8);
    const daten = b.subarray(pos + 8, pos + 8 + laenge);
    if (art === 'IHDR') {
      breite = daten.readUInt32BE(0);
      hoehe = daten.readUInt32BE(4);
      if (daten[8] !== 8 || daten[9] !== 2 || daten[12] !== 0)
        throw new Error(`${pfad}: nur 8 Bit RGB ohne Zeilensprung`);
    } else if (art === 'IDAT') idat.push(daten);
    else if (art === 'IEND') break;
    pos += 12 + laenge;
  }
  const roh = inflateSync(Buffer.concat(idat));
  const zeile = breite * 3;
  const rgb = new Uint8Array(zeile * hoehe);
  for (let y = 0; y < hoehe; y++) {
    const filter = roh[y * (zeile + 1)]!;
    for (let x = 0; x < zeile; x++) {
      const r = roh[y * (zeile + 1) + 1 + x]!;
      const a = x >= 3 ? rgb[y * zeile + x - 3]! : 0;
      const o = y > 0 ? rgb[(y - 1) * zeile + x]! : 0;
      const c = x >= 3 && y > 0 ? rgb[(y - 1) * zeile + x - 3]! : 0;
      let v: number;
      if (filter === 0) v = r;
      else if (filter === 1) v = r + a;
      else if (filter === 2) v = r + o;
      else if (filter === 3) v = r + Math.floor((a + o) / 2);
      else {
        const p = a + o - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - o);
        const pc = Math.abs(p - c);
        v = r + (pa <= pb && pa <= pc ? a : pb <= pc ? o : c);
      }
      rgb[y * zeile + x] = v & 255;
    }
  }
  return { breite, hoehe, rgb };
}

/** Gewichte für das Verkleinern einer Achse über die Fläche (jedes Zielpixel mittelt genau seine Quellfläche). */
function flaechenGewichte(von: number, nach: number): [number, number][][] {
  const f = von / nach;
  return Array.from({ length: nach }, (_, j) => {
    const a = j * f;
    const e = (j + 1) * f;
    const aus: [number, number][] = [];
    for (let i = Math.floor(a); i < Math.ceil(e); i++) {
      const w = Math.min(e, i + 1) - Math.max(a, i);
      if (w > 1e-9) aus.push([i, w / f]);
    }
    return aus;
  });
}

/**
 * Verkleinert über die Fläche, im sRGB-Raum wie die Kantenglättung beim Zeichnen. So zeigt das System ein großes PNG
 * klein (Ersatzbild bis iOS 18), ohne Überschwinger.
 */
export function verkleinern(b: Bild, n: number): Bild {
  const gx = flaechenGewichte(b.breite, n);
  const gy = flaechenGewichte(b.hoehe, n);
  const zwischen = new Float64Array(n * b.hoehe * 3);
  for (let y = 0; y < b.hoehe; y++)
    for (let j = 0; j < n; j++)
      for (const [i, w] of gx[j]!)
        for (let k = 0; k < 3; k++) {
          const z = (y * n + j) * 3 + k;
          zwischen[z] = zwischen[z]! + w * b.rgb[(y * b.breite + i) * 3 + k]!;
        }
  const rgb = new Uint8Array(n * n * 3);
  for (let j = 0; j < n; j++)
    for (let x = 0; x < n; x++)
      for (let k = 0; k < 3; k++) {
        let s = 0;
        for (const [i, w] of gy[j]!) s += w * zwischen[(i * n + x) * 3 + k]!;
        rgb[(j * n + x) * 3 + k] = Math.round(s);
      }
  return { breite: n, hoehe: n, rgb };
}

const linear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
/** Relative Helligkeit wie bei Design (WCAG). */
function helligkeit(b: Bild): Float64Array {
  const aus = new Float64Array(b.breite * b.hoehe);
  for (let i = 0; i < aus.length; i++)
    aus[i] =
      0.2126 * linear(b.rgb[i * 3]!) +
      0.7152 * linear(b.rgb[i * 3 + 1]!) +
      0.0722 * linear(b.rgb[i * 3 + 2]!);
  return aus;
}

/** Liest an Punkten im 1024er Raster, bilinear, an den Pixelmitten (wie map_coordinates mit −0,5). */
function lesen(l: Float64Array, n: number, punkte: [number, number][]): number[] {
  const k = n / 1024;
  const at = (x: number, y: number) =>
    l[Math.min(n - 1, Math.max(0, y)) * n + Math.min(n - 1, Math.max(0, x))]!;
  return punkte.map(([px, py]) => {
    const x = px * k - 0.5;
    const y = py * k - 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    return (
      at(x0, y0) * (1 - fx) * (1 - fy) +
      at(x0 + 1, y0) * fx * (1 - fy) +
      at(x0, y0 + 1) * (1 - fx) * fy +
      at(x0 + 1, y0 + 1) * fx * fy
    );
  });
}

const median = (w: number[]) => {
  const s = [...w].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};
/** Quantil mit linearer Zwischenstufe, wie numpy.quantile. */
export function quantil(w: number[], q: number): number {
  const s = [...w].sort((a, b) => a - b);
  const p = (s.length - 1) * q;
  const u = Math.floor(p);
  return s[u]! + (s[Math.min(u + 1, s.length - 1)]! - s[u]!) * (p - u);
}

// ---------- Geometrie der Klammer ----------

/** Die Klammer im 32er-Raster: Pfad, Lage (Mitte), Maß und Strich. */
export type Klammer = { d: string; cx: number; cy: number; s: number; sw: number };

/** Liest die Klammer aus einem SVG: der Pfad mit `translate(cx cy) scale(s) translate(-15.95 -17.5)` und Strich. */
export function klammerLesen(svg: string): Klammer {
  const m =
    /<path d="([^"]+)" transform="translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\) translate\(-15\.95 -17\.5\)"[^>]*stroke-width="([\d.]+)"/.exec(
      svg,
    );
  if (!m) throw new Error('Keine Klammer im SVG');
  return { d: m[1]!, cx: +m[2]!, cy: +m[3]!, s: +m[4]!, sw: +m[5]! };
}

/** Wandelt den Pfad in Punkte im Abstand von höchstens `schritt` (Einheiten des 32er-Rasters). */
export function pfadPunkte(d: string, schritt = 0.1): [number, number][] {
  const teile = d.match(/[MLHVCSZmlhvcsz]|-?\d*\.?\d+/g)!;
  const roh: [number, number][] = [];
  let x = 0;
  let y = 0;
  let c2: [number, number] | null = null;
  let befehl = '';
  let i = 0;
  const zahl = () => Number(teile[i++]);
  const kubisch = (a: [number, number], b: [number, number], e: [number, number]) => {
    const s0: [number, number] = [x, y];
    for (let t = 1; t <= 40; t++) {
      const u = t / 40;
      const v = 1 - u;
      roh.push([
        v * v * v * s0[0] + 3 * v * v * u * a[0] + 3 * v * u * u * b[0] + u * u * u * e[0],
        v * v * v * s0[1] + 3 * v * v * u * a[1] + 3 * v * u * u * b[1] + u * u * u * e[1],
      ]);
    }
    c2 = b;
    [x, y] = e;
  };
  while (i < teile.length) {
    if (/[A-Za-z]/.test(teile[i]!)) befehl = teile[i++]!;
    const rel = befehl === befehl.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (befehl.toUpperCase()) {
      case 'M':
        x = ox + zahl();
        y = oy + zahl();
        roh.push([x, y]);
        befehl = rel ? 'l' : 'L';
        c2 = null;
        break;
      case 'L':
        x = ox + zahl();
        y = oy + zahl();
        roh.push([x, y]);
        c2 = null;
        break;
      case 'H':
        x = ox + zahl();
        roh.push([x, y]);
        c2 = null;
        break;
      case 'V':
        y = oy + zahl();
        roh.push([x, y]);
        c2 = null;
        break;
      case 'C': {
        const a: [number, number] = [ox + zahl(), oy + zahl()];
        const b: [number, number] = [ox + zahl(), oy + zahl()];
        kubisch(a, b, [ox + zahl(), oy + zahl()]);
        break;
      }
      case 'S': {
        const a: [number, number] = c2 ? [2 * x - c2[0], 2 * y - c2[1]] : [x, y];
        const b: [number, number] = [ox + zahl(), oy + zahl()];
        kubisch(a, b, [ox + zahl(), oy + zahl()]);
        break;
      }
      default:
        throw new Error(`Pfadbefehl ${befehl} nicht unterstützt`);
    }
  }
  // gleichmäßig nachrechnen
  const aus: [number, number][] = [roh[0]!];
  for (let k = 1; k < roh.length; k++) {
    const [ax, ay] = roh[k - 1]!;
    const [bx, by] = roh[k]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / schritt));
    for (let t = 1; t <= n; t++) aus.push([ax + ((bx - ax) * t) / n, ay + ((by - ay) * t) / n]);
  }
  return aus;
}

/** Lücke zwischen äußerem und innerem Haus bei `px`, gerechnet (SY1a): Mitten der Wände 4,9 auseinander. */
export const lueckeGerechnet = (k: Klammer, px: number) => ((4.9 - k.sw) * k.s * px) / 1024;

/**
 * Mittellinie der Lücke und Mitte des Strichs, im 1024er Raster. Ein Punkt liegt auf der Mittellinie, wenn er von
 * zwei getrennten Stellen des Pfads gleich weit weg ist und die beiden Wände so eng stehen, wie Designs Schließen
 * (Radius halbe Lücke + 6 px bei 2048) sie füllt: Abstand der Wandmitten höchstens 4,9 + 6/Maß.
 */
export function lueckenLinien(k: Klammer): { mitte: [number, number][]; kern: [number, number][] } {
  const p = pfadPunkte(k.d, 0.1);
  const bogen = [0];
  for (let i = 1; i < p.length; i++)
    bogen.push(bogen[i - 1]! + Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]));
  const gesamt = bogen.at(-1)!;
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  const schritt = 0.05;
  const eng = 4.9 + 6 / k.s;
  const mitte: [number, number][] = [];
  for (let gy = Math.min(...ys) - 1; gy <= Math.max(...ys) + 1; gy += schritt)
    for (let gx = Math.min(...xs) - 1; gx <= Math.max(...xs) + 1; gx += schritt) {
      let d1 = Infinity;
      let i1 = 0;
      for (let i = 0; i < p.length; i++) {
        const d = (p[i]![0] - gx) ** 2 + (p[i]![1] - gy) ** 2;
        if (d < d1) {
          d1 = d;
          i1 = i;
        }
      }
      d1 = Math.sqrt(d1);
      if (d1 < k.sw / 2 || d1 > eng / 2 + schritt) continue;
      let d2 = Infinity;
      for (let i = 0; i < p.length; i++)
        if (Math.abs(bogen[i]! - bogen[i1]!) > 5)
          d2 = Math.min(d2, (p[i]![0] - gx) ** 2 + (p[i]![1] - gy) ** 2);
      d2 = Math.sqrt(d2);
      if (Math.abs(d1 - d2) <= schritt && d1 + d2 <= eng) mitte.push([gx, gy]);
    }
  const kern = p.filter((_, i) => bogen[i]! > 1 && bogen[i]! < gesamt - 1);
  const raster = (q: [number, number]): [number, number] => [
    k.cx + (q[0] - 15.95) * k.s,
    k.cy + (q[1] - 17.5) * k.s,
  ];
  return { mitte: mitte.map(raster), kern: kern.map(raster) };
}

/** Punkte auf dem Deckel, wie in luecke118.py. */
const DECKEL_PUNKTE: [number, number][] = [
  ...Array.from({ length: 30 }, (_, i): [number, number] => [60, 150 + i * 25]),
  [700, 140],
  [700, 900],
];

/**
 * Lückentiefe (SY1b): an jedem Punkt der Mittellinie (Klammer − Lücke) / (Klammer − Deckel); 1 ist ganz offen, 0 zu.
 * Ergebnis ist das 10-%-Quantil, wie bei Design.
 */
export function lueckenTiefe(
  bild: Bild,
  linien: { mitte: [number, number][]; kern: [number, number][] },
): number {
  const l = helligkeit(bild);
  const lk = median(lesen(l, bild.breite, linien.kern));
  const ld = median(lesen(l, bild.breite, DECKEL_PUNKTE));
  const tiefe = lesen(l, bild.breite, linien.mitte).map((lg) => (lk - lg) / (lk - ld));
  return quantil(tiefe, 0.1);
}

/** Anteile der Flächen (SY10): jedes Pixel zur nächsten Farbe (Summe der Abstände je Kanal), in Prozent. */
export function flaechen(
  bild: Bild,
  farben: { Deckel: string[]; Klammer: string[]; Seiten: string[]; Rest: string[] },
): Record<string, number> {
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const liste = Object.entries(farben).flatMap(([n, cs]) => cs.map((c) => [n, hex(c)] as const));
  const zahl: Record<string, number> = { Deckel: 0, Klammer: 0, Seiten: 0, Rest: 0 };
  const n = bild.breite * bild.hoehe;
  for (let i = 0; i < n; i++) {
    let best = Infinity;
    let name = '';
    for (const [nm, c] of liste) {
      const d =
        Math.abs(bild.rgb[i * 3]! - c[0]!) +
        Math.abs(bild.rgb[i * 3 + 1]! - c[1]!) +
        Math.abs(bild.rgb[i * 3 + 2]! - c[2]!);
      if (d < best) {
        best = d;
        name = nm;
      }
    }
    zahl[name]! += 1;
  }
  return Object.fromEntries(Object.entries(zahl).map(([k, v]) => [k, (v / n) * 100]));
}
