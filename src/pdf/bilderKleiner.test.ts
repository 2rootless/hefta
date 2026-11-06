import { deflateSync } from 'node:zlib';
import { PDFDocument, PDFName, PDFRawStream, StandardFonts } from '@cantoo/pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import {
  bilderSchaetzen,
  bilderVerkleinern,
  LANGE_KANTE,
  pngZeilenAufheben,
  rohAlsRgba,
  type Bildkodierer,
} from './bilderKleiner';

const WINZIG = new Uint8Array(2000).fill(7);
const kodierer = (): ReturnType<typeof vi.fn<Bildkodierer>> =>
  vi.fn<Bildkodierer>(async () => ({ jpeg: WINZIG, breite: 100, hoehe: 140 }));

/** Eine Seite mit Text darüber, wie ein Scan mit Textschicht. Das Bild hängt wie sonst auch an der Seite. */
async function pdfMitBild(eintraege: Record<string, unknown>, inhalt: Uint8Array) {
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  const seite = doc.addPage([595, 842]);
  const ref = doc.context.register(
    doc.context.stream(inhalt, { Type: 'XObject', Subtype: 'Image', ...eintraege } as never),
  );
  seite.node.newXObject('Scan', ref);
  seite.drawText('Textschicht', { x: 60, y: 700, size: 18, font: schrift });
  return doc.save();
}

async function bilder(daten: Uint8Array) {
  const doc = await PDFDocument.load(daten);
  const gefunden: PDFRawStream[] = [];
  for (const [, o] of doc.context.enumerateIndirectObjects())
    if (o instanceof PDFRawStream && o.dict.lookup(PDFName.of('Subtype')) === PDFName.of('Image'))
      gefunden.push(o);
  return gefunden;
}

/** Bytes, die sich nicht packen lassen. */
function rauschen(laenge: number): Uint8Array {
  const aus = new Uint8Array(laenge);
  let x = 1;
  for (let i = 0; i < laenge; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    aus[i] = x >>> 24;
  }
  return aus;
}

const FAST_FERTIG = rauschen(400 * 1024);

describe('Bilder im PDF verkleinern', () => {
  const jpeg = {
    Width: 2480,
    Height: 3508,
    BitsPerComponent: 8,
    ColorSpace: 'DeviceRGB',
    Filter: 'DCTDecode',
  };

  it('tauscht ein großes JPEG, die Seite und ihr Text bleiben', async () => {
    const daten = await pdfMitBild(jpeg, FAST_FERTIG);
    const kodieren = kodierer();
    const klein = await bilderVerkleinern(daten, kodieren);
    expect(kodieren).toHaveBeenCalledOnce();
    expect(klein.length).toBeLessThan(daten.length / 10);

    const [bild] = await bilder(klein);
    expect(bild!.contents).toEqual(WINZIG);
    expect(bild!.dict.lookup(PDFName.of('Width'))?.toString()).toBe('100');
    expect(bild!.dict.lookup(PDFName.of('Height'))?.toString()).toBe('140');
    expect(bild!.dict.lookup(PDFName.of('Filter'))).toBe(PDFName.of('DCTDecode'));

    const doc = await PDFDocument.load(klein);
    expect(doc.getPageCount()).toBe(1);
    const schriften = doc.getPages()[0]!.node.Resources()!.lookup(PDFName.of('Font'));
    expect(schriften?.toString()).toContain('/');
  });

  it('lässt alles andere stehen und gibt dann die alte Datei zurück', async () => {
    const faelle: Record<string, unknown>[] = [
      { ...jpeg, ColorSpace: 'DeviceCMYK' },
      { ...jpeg, Decode: [1, 0, 1, 0, 1, 0] },
      { ...jpeg, Filter: 'JPXDecode' },
      { ...jpeg, Filter: ['ASCII85Decode', 'DCTDecode'] },
      { Width: 2480, Height: 3508, BitsPerComponent: 1, ImageMask: true, Filter: 'FlateDecode' },
      { ...jpeg, Filter: 'FlateDecode', BitsPerComponent: 1 },
    ];
    for (const eintraege of faelle) {
      const daten = await pdfMitBild(eintraege, FAST_FERTIG);
      const kodieren = kodierer();
      expect(await bilderVerkleinern(daten, kodieren)).toBe(daten);
      expect(kodieren).not.toHaveBeenCalled();
    }
  });

  it('kleine und schon fest gepackte Bilder lohnen nicht', async () => {
    const kodieren = kodierer();
    const klein = await pdfMitBild(jpeg, new Uint8Array(50 * 1024));
    expect(await bilderVerkleinern(klein, kodieren)).toBe(klein);
    const fest = await pdfMitBild({ ...jpeg, Width: 1240, Height: 1754 }, FAST_FERTIG);
    expect(await bilderVerkleinern(fest, kodieren)).toBe(fest);
    expect(kodieren).not.toHaveBeenCalled();
  });

  it('bringt das Kodieren nichts oder schlägt es fehl, bleibt die Datei', async () => {
    const daten = await pdfMitBild(jpeg, FAST_FERTIG);
    expect(
      await bilderVerkleinern(daten, async () => ({
        jpeg: new Uint8Array(FAST_FERTIG.length),
        breite: 1,
        hoehe: 1,
      })),
    ).toBe(daten);
    expect(await bilderVerkleinern(daten, async () => null)).toBe(daten);
    const fehler = await bilderVerkleinern(daten, () => Promise.reject(new Error('kaputt')));
    expect(fehler).toBe(daten);
  });

  it('die Maske bleibt und das Bild behält sie', async () => {
    const doc = await PDFDocument.create();
    const seite = doc.addPage([595, 842]);
    const maske = doc.context.register(
      doc.context.stream(FAST_FERTIG, {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 2480,
        Height: 3508,
        BitsPerComponent: 8,
        ColorSpace: 'DeviceGray',
        Filter: 'DCTDecode',
      } as never),
    );
    const bild = doc.context.register(
      doc.context.stream(FAST_FERTIG, {
        Type: 'XObject',
        Subtype: 'Image',
        ...jpeg,
        SMask: maske,
      } as never),
    );
    seite.node.newXObject('Scan', bild);
    const kodieren = kodierer();
    const klein = await bilderVerkleinern(await doc.save(), kodieren);
    expect(kodieren).toHaveBeenCalledOnce();
    const liste = await bilder(klein);
    expect(liste).toHaveLength(2);
    expect(liste.map((b) => b.contents.length).sort((a, b) => a - b)).toEqual([
      WINZIG.length,
      FAST_FERTIG.length,
    ]);
    const ohneMaske = liste.find((b) => b.contents.length === WINZIG.length)!;
    expect(ohneMaske.dict.has(PDFName.of('SMask'))).toBe(true);
  });

  it('packt verlustfreie Bilder aus, auch mit PNG-Prädiktor', async () => {
    const breite = 400;
    const hoehe = 600;
    const roh = rauschen(breite * hoehe * 3);
    // Filter „Sub“ in jeder Zeile: So schreiben PNG-Werkzeuge und Scanner das Bild.
    const zeile = breite * 3;
    const vorhergesagt = new Uint8Array((zeile + 1) * hoehe);
    for (let y = 0; y < hoehe; y++) {
      vorhergesagt[y * (zeile + 1)] = 1;
      for (let x = 0; x < zeile; x++) {
        const links = x >= 3 ? roh[y * zeile + x - 3]! : 0;
        vorhergesagt[y * (zeile + 1) + 1 + x] = (roh[y * zeile + x]! - links) & 255;
      }
    }
    const daten = await pdfMitBild(
      {
        Width: breite,
        Height: hoehe,
        BitsPerComponent: 8,
        ColorSpace: 'DeviceRGB',
        Filter: 'FlateDecode',
        DecodeParms: { Predictor: 15, Colors: 3, Columns: breite },
      },
      deflateSync(vorhergesagt),
    );
    const kodieren = kodierer();
    await bilderVerkleinern(daten, kodieren);
    expect(kodieren).toHaveBeenCalledOnce();
    const quelle = kodieren.mock.calls[0]![0];
    expect(quelle.art).toBe('roh');
    expect(quelle.daten).toEqual(roh);
  });

  it('ein Bild, das an keiner Seite hängt, zählt nicht und fällt weg', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    doc.context.register(
      doc.context.stream(FAST_FERTIG, {
        Type: 'XObject',
        Subtype: 'Image',
        ...jpeg,
      } as never),
    );
    const daten = await doc.save();
    const kodieren = kodierer();
    expect(await bilderSchaetzen(daten, kodieren)).toEqual({ vorher: 0, nachher: 0 });
    expect(kodieren).not.toHaveBeenCalled();
  });

  it('schätzt mit dem Verhältnis der Proben über alle Bilder', async () => {
    const daten = await pdfMitBild(jpeg, FAST_FERTIG);
    const schaetzung = await bilderSchaetzen(daten, kodierer());
    expect(schaetzung.vorher).toBe(FAST_FERTIG.length);
    expect(schaetzung.nachher).toBe(WINZIG.length);
    expect(await bilderSchaetzen(await pdfMitBild(jpeg, new Uint8Array(10)), kodierer())).toEqual({
      vorher: 0,
      nachher: 0,
    });
  });
});

describe('Bildpunkte', () => {
  it('hebt jede Art des PNG-Prädiktors auf', () => {
    // Zwei Bildpunkte je Zeile in Grau; Zeilen mit None, Sub, Up, Average und Paeth.
    const daten = new Uint8Array([0, 10, 20, 1, 5, 5, 2, 1, 1, 3, 4, 4, 4, 1, 1]);
    expect([...pngZeilenAufheben(daten, 2, 1)]).toEqual([10, 20, 5, 10, 6, 11, 7, 13, 8, 14]);
  });

  it('mittelt auf höchstens die lange Kante und macht aus Grau RGB', () => {
    const grau = rohAlsRgba(
      { daten: new Uint8Array([0, 100, 100, 200]), breite: 2, hoehe: 2, kanaele: 1 },
      1,
    );
    expect(grau.breite).toBe(1);
    expect(grau.hoehe).toBe(1);
    expect([...grau.pixel]).toEqual([100, 100, 100, 255]);

    const breit = LANGE_KANTE * 2 + 1;
    const rgb = rohAlsRgba(
      { daten: new Uint8Array(breit * 3).fill(9), breite: breit, hoehe: 1, kanaele: 3 },
      LANGE_KANTE,
    );
    expect(rgb.breite).toBeLessThanOrEqual(LANGE_KANTE);
    expect(rgb.hoehe).toBe(1);
    expect([...rgb.pixel.slice(0, 4)]).toEqual([9, 9, 9, 255]);
  });
});
