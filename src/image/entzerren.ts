import { leeresRaster, type Ecken, type Punkt, type Raster } from './raster';

// Gerade rücken: die vier Ecken einer schräg fotografierten Seite auf ein Rechteck abbilden
// (Projektion mit acht Unbekannten), dann jedes Zielpixel aus dem Foto holen (bilinear).

/** 3×3-Matrix zeilenweise, letzte Stelle 1. */
export type Projektion = [number, number, number, number, number, number, number, number, number];

/** Löst A·x = b (Gauß mit Spaltenpivot). Wirft bei entarteten Ecken (z. B. drei auf einer Linie). */
function loesen(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((zeile, i) => [...zeile, b[i]!]);
  for (let s = 0; s < n; s++) {
    let pivot = s;
    for (let z = s + 1; z < n; z++) if (Math.abs(m[z]![s]!) > Math.abs(m[pivot]![s]!)) pivot = z;
    if (Math.abs(m[pivot]![s]!) < 1e-10) throw new Error('Ecken liegen auf einer Linie');
    [m[s], m[pivot]] = [m[pivot]!, m[s]!];
    for (let z = 0; z < n; z++) {
      if (z === s) continue;
      const f = m[z]![s]! / m[s]![s]!;
      for (let k = s; k <= n; k++) m[z]![k]! -= f * m[s]![k]!;
    }
  }
  return m.map((zeile, i) => zeile[n]! / zeile[i]!);
}

/** Projektion, die `von[i]` auf `nach[i]` abbildet (je vier Punkte). */
export function projektion(von: Ecken, nach: Ecken): Projektion {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = von[i]!;
    const { x: u, y: v } = nach[i]!;
    a.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }
  return [...loesen(a, b), 1] as Projektion;
}

export function abbilden(p: Projektion, { x, y }: Punkt): Punkt {
  const w = p[6] * x + p[7] * y + p[8];
  return { x: (p[0] * x + p[1] * y + p[2]) / w, y: (p[3] * x + p[4] * y + p[5]) / w };
}

const abstand = (a: Punkt, b: Punkt) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Größe der geraden Seite aus den Ecken: die längeren der gegenüberliegenden Kanten. Liegt das
 * Verhältnis nahe an A4 (± 8 %), wird es genau A4, damit Briefe nicht leicht gestaucht wirken.
 */
export function zielGroesse(ecken: Ecken, langeSeite?: number): { breite: number; hoehe: number } {
  const [ol, or, ur, ul] = ecken;
  let breite = Math.max(abstand(ol, or), abstand(ul, ur));
  let hoehe = Math.max(abstand(ol, ul), abstand(or, ur));
  const a4 = Math.SQRT2;
  const verhaeltnis = Math.max(breite, hoehe) / Math.min(breite, hoehe);
  if (Math.abs(verhaeltnis - a4) / a4 < 0.08) {
    if (hoehe >= breite) hoehe = breite * a4;
    else breite = hoehe * a4;
  }
  if (langeSeite) {
    const f = langeSeite / Math.max(breite, hoehe);
    breite *= f;
    hoehe *= f;
  }
  return { breite: Math.max(1, Math.round(breite)), hoehe: Math.max(1, Math.round(hoehe)) };
}

/** Holt das Foto innerhalb der Ecken als gerades Rechteck der gewünschten Größe. */
export function entzerren(
  foto: Raster,
  ecken: Ecken,
  ziel: { breite: number; hoehe: number } = zielGroesse(ecken),
): Raster {
  const { breite, hoehe } = ziel;
  const rechteck: Ecken = [
    { x: 0, y: 0 },
    { x: breite, y: 0 },
    { x: breite, y: hoehe },
    { x: 0, y: hoehe },
  ];
  // Vom Ziel ins Foto rechnen: so bekommt jedes Zielpixel genau einen Wert.
  const p = projektion(rechteck, ecken);
  const aus = leeresRaster(breite, hoehe);
  const { width: fb, height: fh, data: d } = foto;
  for (let y = 0; y < hoehe; y++)
    for (let x = 0; x < breite; x++) {
      const q = abbilden(p, { x: x + 0.5, y: y + 0.5 });
      const sx = Math.min(fb - 1, Math.max(0, q.x - 0.5));
      const sy = Math.min(fh - 1, Math.max(0, q.y - 0.5));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(fb - 1, x0 + 1);
      const y1 = Math.min(fh - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const i = (y * breite + x) * 4;
      for (let k = 0; k < 4; k++) {
        const oben = d[(y0 * fb + x0) * 4 + k]! * (1 - fx) + d[(y0 * fb + x1) * 4 + k]! * fx;
        const unten = d[(y1 * fb + x0) * 4 + k]! * (1 - fx) + d[(y1 * fb + x1) * 4 + k]! * fx;
        aus.data[i + k] = oben * (1 - fy) + unten * fy;
      }
    }
  return aus;
}
