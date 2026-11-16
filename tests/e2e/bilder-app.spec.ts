import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { animationenFertig } from './hilfen';
import { HEUTE, SZENARIEN, datensaetze } from './szenarien';

// Bilder von App-Seiten für die Berichte an die Planung (PC48: WebKit bei 390 und 320/130 %, hell und dunkel).
// Kein Test im eigentlichen Sinn: läuft nur mit APP_BILDER=<Liste>, etwa
//   APP_BILDER="01-standard:/person/p-01-standard-0,02-neustart:/rutsch" npx playwright test bilder-app
// Die Bilder liegen in design-sync/app-bilder/ (nicht im Repo). Mit APP_ANSICHTEN=390,320 nur diese Breiten.
test.skip(!process.env.APP_BILDER, 'nur mit APP_BILDER=…');
test.use({ actionTimeout: 15_000 });

const LISTE = (process.env.APP_BILDER ?? '')
  .split(',')
  .filter(Boolean)
  .map((e) => {
    const [szenario, pfad, name, aktionen] = e.split(':');
    return {
      szenario: szenario!,
      pfad: pfad!,
      name: name || `${szenario}${pfad!.replace(/\//g, '_')}`,
      // Knöpfe, die vorher angetippt werden, getrennt mit „>“ (etwa „Los geht’s>Überspringen“).
      aktionen: (aktionen ?? '').split('>').filter(Boolean),
    };
  });
const ANSICHTEN = (process.env.APP_ANSICHTEN ?? '390,320').split(',');

let pdf = '';
async function beispiel() {
  if (pdf) return pdf;
  const doc = await PDFDocument.create();
  const schrift = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of ['Verdienstabrechnung Oktober 2026', 'Seite 2'])
    doc.addPage([595, 842]).drawText(text, { x: 60, y: 760, size: 18, font: schrift });
  pdf = Buffer.from(await doc.save()).toString('base64');
  return pdf;
}

const MONATE = ['Oktober', 'September', 'August', 'Juli', 'Juni'];
async function gehaltsPdfs(anzahl: number) {
  const liste = [];
  for (const monat of MONATE.slice(0, anzahl)) {
    const doc = await PDFDocument.create();
    const fett = await doc.embedFont(StandardFonts.HelveticaBold);
    const schrift = await doc.embedFont(StandardFonts.Helvetica);
    const s = doc.addPage([595, 842]);
    s.drawText('Musterwerk GmbH', { x: 60, y: 780, size: 14, font: fett });
    s.drawText(`Verdienstabrechnung ${monat} 2026`, { x: 60, y: 750, size: 14, font: fett });
    s.drawText('Mitarbeiter: Max Mustermann', { x: 60, y: 720, size: 11, font: schrift });
    s.drawText(`Abrechnungsmonat: ${monat} 2026`, { x: 60, y: 704, size: 11, font: schrift });
    liste.push({
      name: `Gehalt_${monat}_2026.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from(await doc.save()),
    });
  }
  return liste;
}

async function laden(page: Page, szenario: string, pfad: string) {
  const s = SZENARIEN.find((x) => x.id === szenario);
  if (!s) throw new Error(`Szenario ${szenario} gibt es nicht`);
  await page.route('**/__leer', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>leer</title>' }),
  );
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  await page.goto('/__leer');
  await page.evaluate(
    async ({ daten, pdf }) => {
      const db = await new Promise<IDBDatabase>((ok, fehler) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => fehler(r.error);
      });
      const orte = [...db.objectStoreNames];
      const tx = db.transaction(orte, 'readwrite');
      for (const ort of orte) tx.objectStore(ort).clear();
      for (const [ort, liste] of Object.entries(daten))
        for (const d of liste as object[]) tx.objectStore(ort).put(d);
      const bytes = Uint8Array.from(atob(pdf), (z) => z.charCodeAt(0));
      for (const v of (daten as { versionen: { original: string }[] }).versionen)
        tx.objectStore('dateien').put({
          id: v.original,
          createdAt: new Date().toISOString(),
          typ: 'application/pdf',
          groesse: bytes.length,
          daten: bytes.buffer,
        });
      await new Promise((ok) => (tx.oncomplete = ok));
      db.close();
    },
    { daten: datensaetze(s), pdf: await beispiel() },
  );
  page.on('pageerror', (e) => console.log(`Fehler auf ${pfad}: ${e.message}`));
  await page.goto(`/#${pfad}`);
  await page.locator('main h1, main h2').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await animationenFertig(page);
}

for (const ansicht of ANSICHTEN)
  for (const thema of ['hell', 'dunkel'] as const)
    test(`App-Bilder ${ansicht} ${thema}`, async ({ page, browserName }) => {
      test.setTimeout(600_000);
      await page.clock.setFixedTime(HEUTE);
      // 320 px mit 130 % Schrift wie bei Safari: ein Fenster von 246 CSS-Pixeln.
      const breite = ansicht === '320' ? 246 : 390;
      await page.setViewportSize({ width: breite, height: ansicht === '320' ? 437 : 844 });
      await page.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' });
      const ziel = `design-sync/app-bilder/${browserName}-${ansicht}-${thema}`;
      mkdirSync(ziel, { recursive: true });
      for (const { szenario, pfad, name, aktionen } of LISTE) {
        await laden(page, szenario, pfad);
        for (const a of aktionen) {
          // „pdf*3“: drei erzeugte Gehaltsabrechnungen auswählen (W16).
          const anzahl = /^pdf\*(\d+)$/.exec(a)?.[1];
          if (anzahl) {
            await page
              .locator('input[type=file][data-feld=pdf]')
              .setInputFiles(await gehaltsPdfs(Number(anzahl)));
            await page.waitForTimeout(1500);
            continue;
          }
          await page.getByRole('button', { name: a }).first().click();
          await page.waitForTimeout(500);
        }
        if (thema === 'dunkel')
          await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
        await page.waitForTimeout(200);
        await page.screenshot({ path: `${ziel}/${name}.png`, fullPage: true });
      }
    });
