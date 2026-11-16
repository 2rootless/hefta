import { expect, test, type Page } from '@playwright/test';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bewerbungBauen } from '../../src/pdf/bewerbung';
import { SZENARIEN } from './mappen-szenarien';

// Die PDF-Mappe als Bild (design/mappe-pdf.md, Szenarien MP1 bis MP9): rendert jede Seite mit PDF.js im
// Browser, prüft P17 (hartes Schwarzweiß) und schreibt Kontaktbögen nach docs/screenshots/bogen-MP*.png.
// Die Szenarien stehen in mappen-szenarien.ts.

/** Stellt PDF.js unter einer eigenen Adresse bereit, ganz ohne die App. */
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

interface Art {
  name: string;
  bild: string;
  kopf: string;
}

interface Seite {
  bild: string;
  grau: string;
  fehler: string[];
  arten?: Art[];
}

/** Rendert bei 200 dpi und misst P17 wie design/mappe-pdf/druck_sw.py: Schwelle 140 von 255. */
/** Seiten der Selbstauskünfte (DP30: Briefbogen ohne Kopfzeile). */
function auskunftSeiten(e: {
  inhalt: { teile: { abschnitt: string; seite: number; bis: number }[] }[];
}) {
  return e.inhalt.flatMap((p) =>
    p.teile
      .filter((x) => x.abschnitt === 'Selbstauskunft')
      .flatMap((x) => Array.from({ length: x.bis - x.seite + 1 }, (_, k) => x.seite + k)),
  );
}

function rendern(
  page: Page,
  bytes: Uint8Array,
  mitKopf: boolean,
  deckblaetter: number,
  druck: number[] = [],
  /** DP30: Seiten der Selbstauskunft tragen den Briefkopf statt der Kopfzeile. */
  briefbogen: number[] = [],
) {
  return page.evaluate(
    async ({ b64, mitKopf, deckblaetter, druck, briefbogen }) => {
      const pdfjs = await import(/* @vite-ignore */ '/pdf.min.mjs' as string);
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dok = await pdfjs.getDocument({ data, standardFontDataUrl: '/standard_fonts/' })
        .promise;
      const MM = 200 / 25.4;
      const seiten: Seite[] = [];
      for (let n = 1; n <= dok.numPages; n++) {
        const seite = await dok.getPage(n);
        const ansicht = seite.getViewport({ scale: 200 / 72 });
        const leinwand = document.createElement('canvas');
        leinwand.width = ansicht.width;
        leinwand.height = ansicht.height;
        const ctx = leinwand.getContext('2d', { willReadFrequently: true })!;
        await seite.render({ canvasContext: ctx, viewport: ansicht }).promise;
        const W = leinwand.width;
        const H = leinwand.height;
        const bild = ctx.getImageData(0, 0, W, H);
        const grau = new Float32Array(W * H);
        for (let i = 0; i < W * H; i++)
          grau[i] =
            0.299 * bild.data[i * 4]! +
            0.587 * bild.data[i * 4 + 1]! +
            0.114 * bild.data[i * 4 + 2]!;
        const zaehlen = (x0: number, y0: number, x1: number, y1: number) => {
          let z = 0;
          for (let y = Math.floor(y0); y < y1; y++)
            for (let x = Math.floor(x0); x < x1; x++) if (grau[y * W + x]! <= 140) z++;
          return z;
        };
        const fehler: string[] = [];
        if (mitKopf && n > deckblaetter && !briefbogen.includes(n)) {
          if (zaehlen(12 * MM, 5 * MM, W / 2, 12 * MM) < 20)
            fehler.push(`Seite ${n}: Kopfzeile links ohne lesbare Schrift`);
          if (zaehlen(W / 2, 5 * MM, W - 12 * MM, 12 * MM) < 20)
            fehler.push(`Seite ${n}: Kopfzeile rechts ohne lesbare Schrift`);
          let linie = 0;
          for (let y = Math.floor(13 * MM); y < 15 * MM; y++)
            linie = Math.max(linie, zaehlen(0, y, W, y + 1));
          if (linie < 0.8 * W)
            fehler.push(`Seite ${n}: keine durchgehende Linie (${linie} von ${W})`);
        }
        if (mitKopf && zaehlen(W - 50 * MM, H - 12 * MM, W - 12 * MM, H - 6 * MM) < 10)
          fehler.push(`Seite ${n}: Seitenzahl unten nicht lesbar`);

        const klein = (quelle: HTMLCanvasElement) => {
          const c = document.createElement('canvas');
          c.width = Math.round(W * 0.28);
          c.height = Math.round(H * 0.28);
          const k = c.getContext('2d')!;
          k.imageSmoothingQuality = 'high';
          k.drawImage(quelle, 0, 0, c.width, c.height);
          return c.toDataURL('image/png');
        };
        const band = (quelle: HTMLCanvasElement) => {
          const c = document.createElement('canvas');
          c.width = Math.round(W * 0.75);
          c.height = Math.round(24 * MM * 0.75);
          const k = c.getContext('2d')!;
          k.imageSmoothingQuality = 'high';
          k.drawImage(quelle, 0, 0, W, 24 * MM, 0, 0, c.width, c.height);
          return c.toDataURL('image/png');
        };
        const gefaerbt = (wert: (g: number, i: number) => number) => {
          const c = document.createElement('canvas');
          c.width = W;
          c.height = H;
          const k = c.getContext('2d')!;
          const d = k.createImageData(W, H);
          for (let i = 0; i < W * H; i++) {
            const v = wert(grau[i]!, i);
            d.data[i * 4] = v;
            d.data[i * 4 + 1] = v;
            d.data[i * 4 + 2] = v;
            d.data[i * 4 + 3] = 255;
          }
          k.putImageData(d, 0, 0);
          return c;
        };
        const eintrag: Seite = { bild: klein(leinwand), grau: klein(gefaerbt((g) => g)), fehler };
        if (druck.includes(n)) {
          // Fehlerverteilung, wie ein Laserdrucker rastert.
          const rest = Float32Array.from(grau);
          for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
              const i = y * W + x;
              const alt = rest[i]!;
              const neu = alt > 127 ? 255 : 0;
              rest[i] = neu;
              const f = alt - neu;
              if (x + 1 < W) rest[i + 1] = rest[i + 1]! + (f * 7) / 16;
              if (y + 1 < H) {
                if (x > 0) rest[i + W - 1] = rest[i + W - 1]! + (f * 3) / 16;
                rest[i + W] = rest[i + W]! + (f * 5) / 16;
                if (x + 1 < W) rest[i + W + 1] = rest[i + W + 1]! + f / 16;
              }
            }
          const art = (name: string, c: HTMLCanvasElement): Art => ({
            name,
            bild: klein(c),
            kopf: band(c),
          });
          eintrag.arten = [
            art('Farbe', leinwand),
            art(
              'Graustufen',
              gefaerbt((g) => g),
            ),
            art(
              'Schwarzweiß, gerastert',
              gefaerbt((_, i) => rest[i]!),
            ),
            art(
              'Schwarzweiß, hart',
              gefaerbt((g) => (g > 140 ? 255 : 0)),
            ),
            art(
              'Tonersparen',
              gefaerbt((g) => 255 - (255 - g) * 0.45),
            ),
          ];
        }
        seiten.push(eintrag);
      }
      return seiten;
    },
    { b64: Buffer.from(bytes).toString('base64'), mitKopf, deckblaetter, druck, briefbogen },
  );
}

async function bild(page: Page, html: string, breite: number, pfad: string) {
  const kontext = await page
    .context()
    .browser()!
    .newContext({ viewport: { width: breite, height: 800 }, deviceScaleFactor: 1 });
  const blatt = await kontext.newPage();
  await blatt.setContent(
    `<body style="margin:0;padding:16px;background:#c9ccd6;font:bold 18px sans-serif;color:#191a2c">${html}</body>`,
  );
  await blatt.waitForLoadState('load');
  await blatt.screenshot({ path: pfad, fullPage: true });
  await kontext.close();
}

const BLATT = 'display:block;background:#fff';

const bogen = (page: Page, bilder: string[], pfad: string) =>
  bild(
    page,
    `<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">${bilder
      .map((b) => `<img src="${b}" style="${BLATT}">`)
      .join('')}</div>`,
    2900,
    pfad,
  );

/** Die Mappe in fünf Druckarten: je Zeile eine Seite, je Spalte eine Art. */
function druckBogen(page: Page, zeilen: Art[][], pfad: string) {
  const kopf = zeilen[0]!.map((a) => `<div>${a.name}</div>`).join('');
  const seiten = zeilen.flat().map((a) => `<img src="${a.bild}" style="${BLATT}">`);
  return bild(
    page,
    `<div style="display:grid;grid-template-columns:repeat(5,max-content);gap:16px">${kopf}${seiten.join('')}</div>`,
    2500,
    pfad,
  );
}

/** Das Kopfband groß in allen Druckarten untereinander. */
function kopfBogen(page: Page, arten: Art[], pfad: string) {
  return bild(
    page,
    arten
      .map(
        (a) =>
          `<div style="margin-bottom:8px">${a.name}</div><img src="${a.kopf}" style="${BLATT};margin-bottom:20px">`,
      )
      .join(''),
    1300,
    pfad,
  );
}

/** Der Text jeder Seite, wie ihn ein Programm liest. */
async function textJeSeite(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const dok = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const texte: string[] = [];
  for (let n = 1; n <= dok.numPages; n++) {
    const { items } = await (await dok.getPage(n)).getTextContent();
    texte.push(items.map((i) => ('str' in i ? i.str : '')).join(' '));
  }
  return texte;
}

test.describe('PDF-Mappe als Bild', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'PDF.js im Browser nur in Chromium');

  for (const [id, bauen] of Object.entries(SZENARIEN)) {
    test(`${id}: P17 und Kontaktbogen`, async ({ page }) => {
      test.setTimeout(240_000);
      const a = await bauen();
      const e = await bewerbungBauen(a);
      await pdfjsLaden(page);
      const standard = id === 'MP1-standard';
      const deckblaetter = a.deckblatt ? e.inhalt[0]!.seite - 1 : 0;
      const seiten = await rendern(
        page,
        e.bytes,
        a.fusszeile,
        deckblaetter,
        standard ? [1, 9, 16] : [],
        auskunftSeiten(e),
      );
      expect(seiten).toHaveLength(e.seiten);
      await bogen(
        page,
        seiten.map((s) => s.bild),
        `docs/screenshots/bogen-${id}.png`,
      );
      if (standard) {
        await bogen(
          page,
          seiten.map((s) => s.grau),
          `docs/screenshots/bogen-${id}-grau.png`,
        );
        const zeilen = seiten.flatMap((s) => (s.arten ? [s.arten] : []));
        await druckBogen(page, zeilen, 'docs/screenshots/druck-arten-MP1.png');
        await kopfBogen(page, zeilen[1]!, 'docs/screenshots/druck-kopfband.png');
        // vermieter.spec.ts liest die Datei womöglich gerade: Sie erscheint erst, wenn sie ganz ist.
        const muster = `docs/screenshots/muster-${id}.pdf`;
        writeFileSync(`${muster}.tmp`, e.bytes);
        renameSync(`${muster}.tmp`, muster);
      }
      expect(seiten.flatMap((s) => s.fehler)).toEqual([]);
      expect(e.ersetzt).toEqual([]);
    });
  }

  // Aussehen der Mappe: P17 gilt in allen drei, Schlicht hat keine Farbe, die anderen nur wenig.
  for (const aussehen of [
    { art: 'schlicht' },
    { art: 'einefarbe', akzent: 'bordeaux' },
    { art: 'personen' },
  ] as const) {
    test(`Aussehen ${aussehen.art}: P17, Farbe nur als Zusatz`, async ({ page }) => {
      test.setTimeout(240_000);
      const a = { ...(await SZENARIEN['MP1-standard']!()), aussehen };
      const e = await bewerbungBauen(a);
      await pdfjsLaden(page);
      const deckblaetter = e.inhalt[0]!.seite - 1;
      const seiten = await rendern(page, e.bytes, a.fusszeile, deckblaetter, [], auskunftSeiten(e));
      expect(seiten.flatMap((s) => s.fehler)).toEqual([]);
      await bogen(
        page,
        seiten.map((s) => s.bild),
        `docs/screenshots/bogen-MP1-aussehen-${aussehen.art}.png`,
      );
      // Bunte Punkte auf Deckblatt und in der Kopfzeile einer Unterlage.
      const bunt = await page.evaluate(
        async ({ b64, seite }) => {
          const pdfjs = await import(/* @vite-ignore */ '/pdf.min.mjs' as string);
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
          const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const dok = await pdfjs.getDocument({ data, standardFontDataUrl: '/standard_fonts/' })
            .promise;
          const zaehlen = async (nummer: number, hoehe: number) => {
            const s = await dok.getPage(nummer);
            const ansicht = s.getViewport({ scale: 2 });
            const c = document.createElement('canvas');
            c.width = ansicht.width;
            c.height = ansicht.height;
            const k = c.getContext('2d', { willReadFrequently: true })!;
            await s.render({ canvasContext: k, viewport: ansicht }).promise;
            const d = k.getImageData(0, 0, c.width, Math.round(c.height * hoehe)).data;
            let n = 0;
            for (let i = 0; i < d.length; i += 4)
              if (
                Math.max(d[i]!, d[i + 1]!, d[i + 2]!) - Math.min(d[i]!, d[i + 1]!, d[i + 2]!) >
                40
              )
                n++;
            return n;
          };
          return { deck: await zaehlen(1, 1), kopf: await zaehlen(seite, 0.06) };
        },
        {
          b64: Buffer.from(e.bytes).toString('base64'),
          // DP30: die erste fremde Seite; die Selbstauskunft hat den Briefkopf ohne Farbe.
          seite: e.inhalt[0]!.teile.find((x) => x.abschnitt !== 'Selbstauskunft')!.seite,
        },
      );
      if (aussehen.art === 'schlicht') expect(bunt).toEqual({ deck: 0, kopf: 0 });
      else {
        expect(bunt.deck).toBeGreaterThan(0);
        expect(bunt.kopf).toBeGreaterThan(0);
      }
    });
  }

  test('P19: Die Selbstauskunft der Bürgin nennt nur ihre eigenen Angaben', async () => {
    const texte = await textJeSeite(
      (await bewerbungBauen(await SZENARIEN['MP1-standard']!())).bytes,
    );
    const auskunftVon = (name: string) =>
      texte.slice(1).find((t) => t.includes(name) && /Selbstauskunft.*Insolvenz/.test(t))!;
    const petra = auskunftVon('Petra Mustermann');
    expect(petra).toContain('1.850 €');
    expect(petra).not.toContain('Personen, die einziehen');
    expect(petra).not.toContain('Haustiere');
    // DP30: „Hamburg“ steht im Briefkopf (Ort der Wohnung), nicht als Ort ihrer Angaben.
    expect(petra).not.toContain('Hamburg, 2. November 2026');
    const max = auskunftVon('Max Mustermann');
    expect(max).toContain('Personen, die einziehen');
    expect(max).toContain('Hamburg, 2. November 2026');
  });

  test('P18, Kontakt: Bei drei Nachnamen nur diese, Kontakt ist die erste im Vertrag', async () => {
    const texte = await textJeSeite(
      (await bewerbungBauen(await SZENARIEN['MP3-lange-namen']!())).bytes,
    );
    expect(texte[1]).toContain('Müller-Lüdenscheidt, Wiśniewski-Kowalczyk und Becker');
    expect(texte[1]).not.toContain('Hohenstein ·');
    expect(texte[0]).toMatch(/Kontakt\s+Maximilian-Alexander Müller-Lüdenscheidt/);
  });

  test('MP8: Der Inhalt läuft weiter, der Kontakt bleibt auf der ersten Seite', async () => {
    const e = await bewerbungBauen(await SZENARIEN['MP8-langer-inhalt']!());
    const texte = await textJeSeite(e.bytes);
    expect(e.inhalt[0]!.seite).toBe(3);
    expect(texte[0]).toContain('Kontakt');
    // DP30: Seite 2 des Deckblatts mit Briefkopf und „Was beiliegt“, ohne „Fortsetzung“.
    expect(texte[1]).toContain('WAS BEILIEGT');
    expect(texte[1]).not.toContain('Fortsetzung');
    expect(texte[1]).not.toContain('Kontakt');
  });

  test('P12, MP9: Im PDF steht der Name in lateinischen Buchstaben, kein Fragezeichen', async () => {
    const e = await bewerbungBauen(await SZENARIEN['MP9-andere-schrift']!());
    const alles = (await textJeSeite(e.bytes)).join(' ');
    expect(alles).toContain('Olena Kovalenko');
    expect(alles).toContain('Piotr Wiśniewski');
    expect(alles).toContain('Thị Mai Nguyễn');
    expect(alles).toContain('Kovalenko, Wiśniewski und Nguyễn');
    expect(alles).not.toContain('Олена');
    expect(alles).not.toContain('?');
    expect(e.ersetzt).toEqual([]);
  });
});
