import { describe, expect, it } from 'vitest';
import { aufhellen } from './aufhellen';
import { eckenFinden } from './ecken';
import { abbilden, entzerren, projektion, zielGroesse } from './entzerren';
import { drehen, leeresRaster, verkleinern, type Ecken, type Punkt, type Raster } from './raster';

function fuellen(bild: Raster, farbe: [number, number, number]) {
  for (let i = 0; i < bild.data.length; i += 4) {
    bild.data.set(farbe, i);
    bild.data[i + 3] = 255;
  }
}

function pixel(bild: Raster, x: number, y: number): number[] {
  const i = (y * bild.width + x) * 4;
  return [...bild.data.slice(i, i + 4)];
}

/** Liegt p im Viereck (konvex, Ecken im Uhrzeigersinn)? */
function drin(p: Punkt, e: Ecken): boolean {
  for (let i = 0; i < 4; i++) {
    const a = e[i]!;
    const b = e[(i + 1) % 4]!;
    if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < 0) return false;
  }
  return true;
}

/** Dunkler Tisch mit hellem Blatt in den Ecken `blatt`. */
function foto(breite: number, hoehe: number, blatt: Ecken): Raster {
  const bild = leeresRaster(breite, hoehe);
  fuellen(bild, [70, 60, 50]);
  for (let y = 0; y < hoehe; y++)
    for (let x = 0; x < breite; x++)
      if (drin({ x: x + 0.5, y: y + 0.5 }, blatt))
        bild.data.set([235, 232, 225], (y * breite + x) * 4);
  return bild;
}

describe('Raster', () => {
  it('dreht um 90° im Uhrzeigersinn', () => {
    const bild = leeresRaster(2, 1);
    bild.data.set([255, 0, 0, 255, 0, 0, 255, 255]);
    const gedreht = drehen(bild);
    expect([gedreht.width, gedreht.height]).toEqual([1, 2]);
    expect(pixel(gedreht, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(gedreht, 0, 1)).toEqual([0, 0, 255, 255]);
  });

  it('verkleinert durch Mitteln', () => {
    const bild = leeresRaster(4, 4);
    fuellen(bild, [100, 150, 200]);
    const klein = verkleinern(bild, 2);
    expect([klein.width, klein.height]).toEqual([2, 2]);
    expect(pixel(klein, 1, 1)).toEqual([100, 150, 200, 255]);
  });
});

describe('Gerade rücken', () => {
  const schraeg: Ecken = [
    { x: 40, y: 30 },
    { x: 260, y: 50 },
    { x: 280, y: 370 },
    { x: 20, y: 350 },
  ];

  it('bildet die vier Ecken genau ab', () => {
    const rechteck: Ecken = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 141 },
      { x: 0, y: 141 },
    ];
    const p = projektion(rechteck, schraeg);
    rechteck.forEach((ecke, i) => {
      const q = abbilden(p, ecke);
      expect(q.x).toBeCloseTo(schraeg[i]!.x, 6);
      expect(q.y).toBeCloseTo(schraeg[i]!.y, 6);
    });
  });

  it('wirft bei Ecken auf einer Linie', () => {
    const linie: Ecken = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    expect(() => projektion(linie, linie)).toThrow();
  });

  it('rundet auf A4, wenn es fast A4 ist', () => {
    expect(zielGroesse(schraeg)).toEqual({ breite: 261, hoehe: 321 });
    const fastA4 = zielGroesse([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 290 },
      { x: 0, y: 290 },
    ]);
    expect(fastA4).toEqual({ breite: 200, hoehe: 283 });
    const quer = zielGroesse([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 100 },
      { x: 0, y: 100 },
    ]);
    expect(quer).toEqual({ breite: 400, hoehe: 100 });
    expect(zielGroesse(schraeg, 1000).hoehe).toBe(1000);
  });

  it('holt das schräge Blatt als gerades, helles Rechteck', () => {
    const bild = foto(300, 400, schraeg);
    const gerade = entzerren(bild, schraeg, { breite: 100, hoehe: 141 });
    expect([gerade.width, gerade.height]).toEqual([100, 141]);
    // Innen nur Papier, kein Tisch.
    for (const [x, y] of [
      [5, 5],
      [95, 5],
      [50, 70],
      [5, 135],
      [95, 135],
    ] as const)
      expect(pixel(gerade, x, y)[0]).toBeGreaterThan(200);
  });
});

describe('Aufhellen', () => {
  it('macht graues Papier weiß und Schrift dunkel', () => {
    const bild = leeresRaster(10, 10);
    fuellen(bild, [180, 175, 170]);
    for (let i = 0; i < 20; i++) bild.data.set([60, 60, 60], i * 4 * 5);
    const hell = aufhellen(bild);
    expect(pixel(hell, 9, 9)[0]).toBeGreaterThan(245);
    expect(pixel(hell, 0, 0)[0]).toBeLessThan(10);
  });

  it('lässt eine leere Seite in Ruhe', () => {
    const bild = leeresRaster(4, 4);
    fuellen(bild, [200, 200, 200]);
    expect(pixel(aufhellen(bild), 1, 1)[0]).toBeLessThan(255);
  });

  it('kann Graustufen', () => {
    const bild = leeresRaster(2, 2);
    fuellen(bild, [200, 100, 50]);
    const [r, g, b] = pixel(aufhellen(bild, { graustufen: true }), 0, 0);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});

describe('Kanten finden', () => {
  it('findet ein schräges Blatt auf dem Tisch', () => {
    const blatt: Ecken = [
      { x: 90, y: 60 },
      { x: 520, y: 110 },
      { x: 480, y: 720 },
      { x: 50, y: 680 },
    ];
    const ecken = eckenFinden(foto(600, 800, blatt));
    expect(ecken).not.toBeNull();
    ecken!.forEach((e, i) => {
      expect(Math.abs(e.x - blatt[i]!.x)).toBeLessThan(12);
      expect(Math.abs(e.y - blatt[i]!.y)).toBeLessThan(12);
    });
  });

  it('gibt null zurück, wenn kein Blatt zu sehen ist', () => {
    const leer = leeresRaster(200, 200);
    fuellen(leer, [70, 60, 50]);
    expect(eckenFinden(leer)).toBeNull();
    // Das Blatt füllt das ganze Bild: kein Rand, also auch nichts zu finden.
    expect(
      eckenFinden(
        foto(200, 200, [
          { x: -5, y: -5 },
          { x: 205, y: -5 },
          { x: 205, y: 205 },
          { x: -5, y: 205 },
        ]),
      ),
    ).toBeNull();
  });
});
