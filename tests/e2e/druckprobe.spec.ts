import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_NAME, VERMIETER_DOMAIN } from '../../src/app/name';
import { bewerbungBauen } from '../../src/pdf/bewerbung';
import { SZENARIEN } from './mappen-szenarien';

// PC95 (DP71, E200): Druckprobe der Mappe. Kleine Hefta-Texte (bis 9,4 pt) stehen in Tinte, damit sie eine
// Schwarzweiß-Kopie überstehen. Nachgebildet wie in DP71, werkzeug/druck71.py, aber ohne Texterkennung:
// - QA26, Schwarzweiß-Kopie: 150 dpi, weich (Gauß, Radius etwa 0,8 px), dann nur Schwarz oder Weiß (Schwelle 128),
//   voller Toner. Ein Text gilt als wiedergefunden, wenn von seiner Schrift mindestens 5 % schwarz bleiben. Gemessen
//   am 17.11.: in Tinte 88 % der kleinen Texte, im früheren Grau 15 % (81 % verschwinden ganz); DP71 fand mit
//   Texterkennung 83 % und 40 %.
//   Verlangt: mindestens 80 % der kleinen Texte.
// - QA27, Graustufen-Druck: 300 dpi in Graustufen. Ein Text ist lesbar, wenn seine dunkelste Stelle unter 128 liegt.
//   Verlangt: mindestens 90 % aller Texte.
// Gegenproben färben die Schrift beim Messen um: das frühere Grau #6b6258 (QA26) und #b3a99e (QA27) werden rot.
// Grau bleiben dürfen (PC95): „Erstellt mit …“, die Lesehilfe und der Erklärsatz unten auf der Selbstauskunft.

const ERKLAERSATZ = `Angaben der Person selbst. Fragen und Reihenfolge folgen dem Musterbogen der Datenschutzkonferenz; was dort nicht steht, fragt ${APP_NAME} nicht.`;
const DARF_GRAU = [`Erstellt mit ${APP_NAME}`, `Lesehilfe: ${VERMIETER_DOMAIN}`];

async function pdfjsLaden(page: Page) {
  const wurzel = 'node_modules/pdfjs-dist';
  await page.route('http://pdf.test/**', async (route) => {
    const pfad = new URL(route.request().url()).pathname;
    if (pfad === '/') {
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>PDF</title>' });
      return;
    }
    const datei = pfad.startsWith('/standard_fonts/')
      ? join(wurzel, pfad)
      : join(wurzel, 'legacy/build', pfad);
    await route.fulfill({
      contentType: pfad.endsWith('.mjs') ? 'text/javascript' : 'application/octet-stream',
      body: readFileSync(datei),
    });
  });
  await page.goto('http://pdf.test/');
}

interface Messung {
  klein: number;
  kopieGefunden: number;
  alle: number;
  graustufenLesbar: number;
  verloren: string[];
}

/**
 * Misst alle Seiten. `tinteNach` färbt die Schrift beim Messen um: Ein Pixel, das in Tinte (Grauwert 34) gedruckt
 * wäre, bekommt den Grauwert der anderen Farbe, anteilig nach der Deckung. Ohne Wert misst es die Mappe, wie sie ist.
 */
function messen(page: Page, bytes: Uint8Array, ausnahmen: string[], tinteNach?: number) {
  return page.evaluate(
    async ({ b64, ausnahmen, tinteNach }) => {
      const pdfjs = await import(/* @vite-ignore */ '/pdf.min.mjs' as string);
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      interface Ansicht {
        width: number;
        height: number;
        scale: number;
        transform: number[];
      }
      interface Seite {
        getViewport(o: { scale: number }): Ansicht;
        render(o: { canvasContext: CanvasRenderingContext2D; viewport: Ansicht }): {
          promise: Promise<void>;
        };
        getTextContent(): Promise<{ items: unknown[] }>;
      }
      interface Text {
        str: string;
        transform: number[];
        width: number;
      }
      const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dok = await pdfjs.getDocument({ data, standardFontDataUrl: '/standard_fonts/' })
        .promise;
      const umfaerben = (v: number) =>
        tinteNach === undefined ? v : 255 - ((255 - v) * (255 - tinteNach)) / (255 - 34);
      const grauBild = async (seite: Seite, dpi: number) => {
        const ansicht = seite.getViewport({ scale: dpi / 72 });
        const c = document.createElement('canvas');
        c.width = Math.ceil(ansicht.width);
        c.height = Math.ceil(ansicht.height);
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        await seite.render({ canvasContext: ctx, viewport: ansicht }).promise;
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const g = new Float32Array(c.width * c.height);
        for (let i = 0; i < g.length; i++)
          g[i] = umfaerben(0.299 * d[i * 4]! + 0.587 * d[i * 4 + 1]! + 0.114 * d[i * 4 + 2]!);
        return { g, w: c.width, h: c.height, ansicht };
      };
      // Weich wie ein Kopierer: Gauß mit Radius etwa 0,8 px, getrennt in beiden Richtungen.
      const kern = [0.0545, 0.2442, 0.4026, 0.2442, 0.0545];
      const weich = (g: Float32Array, w: number, h: number) => {
        const a = new Float32Array(g.length);
        const b = new Float32Array(g.length);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            let s = 0;
            for (let k = -2; k <= 2; k++)
              s += kern[k + 2]! * g[y * w + Math.min(w - 1, Math.max(0, x + k))]!;
            a[y * w + x] = s;
          }
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            let s = 0;
            for (let k = -2; k <= 2; k++)
              s += kern[k + 2]! * a[Math.min(h - 1, Math.max(0, y + k)) * w + x]!;
            b[y * w + x] = s;
          }
        return b;
      };
      const kasten = (item: Text, ansicht: Ansicht) => {
        const t = pdfjs.Util.transform(ansicht.transform, item.transform);
        const groesse = Math.hypot(item.transform[2]!, item.transform[3]!);
        const hoehe = groesse * ansicht.scale;
        return {
          groesse,
          x0: Math.floor(t[4]),
          x1: Math.ceil(t[4] + item.width * ansicht.scale),
          y0: Math.floor(t[5] - hoehe),
          y1: Math.ceil(t[5] + hoehe * 0.25),
        };
      };
      const m = {
        klein: 0,
        kopieGefunden: 0,
        alle: 0,
        graustufenLesbar: 0,
        verloren: [] as string[],
      };
      for (let n = 1; n <= dok.numPages; n++) {
        const seite = (await dok.getPage(n)) as Seite;
        const inhalt = await seite.getTextContent();
        const texte = inhalt.items.filter(
          (i): i is Text =>
            typeof (i as Text).str === 'string' &&
            (i as Text).str.replaceAll('­', '').trim().length >= 3 &&
            !ausnahmen.some(
              (a: string) =>
                a.includes((i as Text).str.trim()) || (i as Text).str.trim().startsWith(a),
            ),
        );
        // QA27: Graustufen-Druck, 300 dpi.
        const g3 = await grauBild(seite, 300);
        for (const i of texte) {
          const k = kasten(i, g3.ansicht);
          let min = 255;
          for (let y = Math.max(0, k.y0); y < Math.min(g3.h, k.y1); y++)
            for (let x = Math.max(0, k.x0); x < Math.min(g3.w, k.x1); x++)
              min = Math.min(min, g3.g[y * g3.w + x]!);
          m.alle++;
          if (min < 128) m.graustufenLesbar++;
        }
        // QA26: Schwarzweiß-Kopie, 150 dpi, nur die kleinen Texte.
        const g1 = await grauBild(seite, 150);
        const w1 = weich(g1.g, g1.w, g1.h);
        for (const i of texte) {
          const k = kasten(i, g1.ansicht);
          if (k.groesse > 9.4) continue;
          let tinte = 0;
          let schwarz = 0;
          for (let y = Math.max(0, k.y0); y < Math.min(g1.h, k.y1); y++)
            for (let x = Math.max(0, k.x0); x < Math.min(g1.w, k.x1); x++) {
              if (g1.g[y * g1.w + x]! < 200) tinte++;
              if (w1[y * g1.w + x]! < 128) schwarz++;
            }
          if (tinte === 0) continue;
          m.klein++;
          if (schwarz / tinte >= 0.05) m.kopieGefunden++;
          else if (m.verloren.length < 12) m.verloren.push(`S. ${n}: ${i.str.trim().slice(0, 40)}`);
        }
      }
      return m;
    },
    { b64: Buffer.from(bytes).toString('base64'), ausnahmen, tinteNach },
  ) as Promise<Messung>;
}

test.describe('PC95 (DP71): Druckprobe der Mappe', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'PDF.js im Browser nur in Chromium');

  test('QA26 und QA27: kleine Texte überstehen Schwarzweiß-Kopie und Graustufen-Druck; Gegenproben werden rot', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const bytes = (await bewerbungBauen(await SZENARIEN['MP1-standard']!())).bytes;
    await pdfjsLaden(page);
    const ausnahmen = [ERKLAERSATZ, ...DARF_GRAU];
    const heute = await messen(page, bytes, ausnahmen);
    console.log('QA26/QA27 heute:', JSON.stringify(heute));
    expect(heute.klein).toBeGreaterThan(20);
    expect(
      heute.kopieGefunden / heute.klein,
      `QA26, verloren: ${heute.verloren.join(' | ')}`,
    ).toBeGreaterThanOrEqual(0.8);
    expect(heute.graustufenLesbar / heute.alle, 'QA27').toBeGreaterThanOrEqual(0.9);
    // Gegenprobe QA26: dieselben Texte im früheren Grau #6b6258 (Grauwert 98) verschwinden in der Kopie.
    const grau = await messen(page, bytes, ausnahmen, 98);
    console.log('QA26 Gegenprobe Grau:', JSON.stringify(grau));
    expect(grau.kopieGefunden / grau.klein).toBeLessThan(0.8);
    // Gegenprobe QA27: in #b3a99e (Grauwert 170) ist im Graustufen-Druck kaum noch etwas lesbar.
    const hell = await messen(page, bytes, ausnahmen, 170);
    console.log('QA27 Gegenprobe hell:', JSON.stringify(hell));
    expect(hell.graustufenLesbar / hell.alle).toBeLessThan(0.9);
  });
});
