// Seitenbilder fürs Design (PC18, DP26 F3): jede Seite einer PDF als PNG, 1200 px breit, mit pdf.js in
// Chromium gerendert, wie die Vermieterseite sie zeigt.
// Aufruf: node scripts/seitenbilder.mjs <datei.pdf> <zielordner> [präfix]
//
// Stapel der Landingpage (DP34, PC35): Ändert sich die Beispiel-Mappe, entstehen die vier Bilder neu mit
//   node scripts/seitenbilder.mjs web/beispiel-mappe.pdf <zielordner> --stapel
// Seiten 1, 2, 3 und 5, 520 px breit, JPEG mit Qualität 84 (Deckblatt) und 72 (die anderen), als
// mappe-seite-1.jpg bis -4.jpg. Chromium schreibt JPEG ohne „progressiv“; DP34 wünscht progressiv. Dafür
// fehlt noch ein Werkzeug (Frage in CP24).
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [pdf, ziel, praefixRoh = 'seite'] = process.argv.slice(2);
const STAPEL = praefixRoh === '--stapel';
const praefix = STAPEL ? 'mappe-seite' : praefixRoh;
const BREITE = STAPEL ? 520 : 1200;
mkdirSync(ziel, { recursive: true });
const basis = join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route('http://ansicht.test/**', (route) => {
  const name = new URL(route.request().url()).pathname.slice(1);
  if (name === 'datei.pdf')
    return route.fulfill({ body: readFileSync(pdf), contentType: 'application/pdf' });
  if (name.endsWith('.mjs'))
    return route.fulfill({ body: readFileSync(join(basis, name)), contentType: 'text/javascript' });
  return route.fulfill({
    contentType: 'text/html',
    body: `<body style="margin:0"><script type="module">
      import * as pdfjs from '/pdf.mjs';
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
      const doc = await pdfjs.getDocument({ url: '/datei.pdf' }).promise;
      window.anzahl = doc.numPages;
      window.zeichnen = async (n, art = 'image/png', guete = 1) => {
        const seite = await doc.getPage(n);
        const vp = seite.getViewport({ scale: ${BREITE} / seite.getViewport({ scale: 1 }).width });
        const c = document.createElement('canvas');
        c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const k = c.getContext('2d');
        k.fillStyle = '#fff'; k.fillRect(0, 0, c.width, c.height);
        await seite.render({ canvas: c, canvasContext: k, viewport: vp }).promise;
        return c.toDataURL(art, guete);
      };
      document.title = 'bereit';
    </script></body>`,
  });
});
await page.goto('http://ansicht.test/index.html');
await page.waitForFunction(() => document.title === 'bereit', null, { timeout: 20000 });
const anzahl = await page.evaluate(() => window.anzahl);
if (STAPEL) {
  // DP34, Abschnitt 3: von hinten nach vorn Seite 5, 3, 2 und vorn das Deckblatt.
  for (const [nr, seite, guete] of [
    [1, 1, 0.84],
    [2, 2, 0.72],
    [3, 3, 0.72],
    [4, 5, 0.72],
  ]) {
    if (seite > anzahl) throw new Error(`Die Mappe hat keine Seite ${seite}`);
    const url = await page.evaluate(
      ([s, g]) => window.zeichnen(s, 'image/jpeg', g),
      [seite, guete],
    );
    writeFileSync(join(ziel, `${praefix}-${nr}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
  }
} else {
  for (let n = 1; n <= anzahl; n++) {
    const url = await page.evaluate((n) => window.zeichnen(n), n);
    const datei = join(ziel, `${praefix}-${String(n).padStart(2, '0')}.png`);
    writeFileSync(datei, Buffer.from(url.split(',')[1], 'base64'));
  }
}
console.log(pdf, anzahl, 'Seiten');
await browser.close();
