// Entwicklerwerkzeug zur Sichtprüfung erzeugter PDFs: rendert eine Seite mit pdf.js in Chromium.
// Aufruf: node scripts/pdf-ansicht.mjs <datei.pdf> <bild.png> [seite]
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [pdf, png, seiteArg] = process.argv.slice(2);
const nummer = Number(seiteArg ?? 1);
const basis = join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
await page.route('http://ansicht.test/**', (route) => {
  const name = new URL(route.request().url()).pathname.slice(1);
  if (name === 'datei.pdf')
    return route.fulfill({ body: readFileSync(pdf), contentType: 'application/pdf' });
  if (name.endsWith('.mjs'))
    return route.fulfill({ body: readFileSync(join(basis, name)), contentType: 'text/javascript' });
  return route.fulfill({
    contentType: 'text/html',
    body: `<body style="margin:0"><canvas id="c"></canvas><script type="module">
      import * as pdfjs from '/pdf.mjs';
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
      const doc = await pdfjs.getDocument({ url: '/datei.pdf' }).promise;
      const seite = await doc.getPage(${nummer});
      const vp = seite.getViewport({ scale: 2 });
      const c = document.getElementById('c');
      c.width = vp.width; c.height = vp.height;
      await seite.render({ canvas: c, canvasContext: c.getContext('2d'), viewport: vp }).promise;
      document.title = 'fertig';
    </script></body>`,
  });
});
await page.goto('http://ansicht.test/index.html');
await page.waitForFunction(() => document.title === 'fertig', null, { timeout: 20000 });
await page.locator('#c').screenshot({ path: png });
await browser.close();
