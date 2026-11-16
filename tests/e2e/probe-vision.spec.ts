import { expect, test } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';

// Probe Vision gegen Tesseract (PC75), nur auf dem Zweig probe-vision: Die Seite liest Musterfotos mit
// Tesseract auf dem Gerät und gibt das Ergebnis als Text aus. Im Browser gibt es Vision nicht; das steht
// dann als Fehler im Ergebnis. Keine Anfrage verlässt den eigenen Ursprung (W11).

// Ohne Service Worker, damit der Test die Liste der Fotos kürzen kann.
test.use({ serviceWorkers: 'block' });

test('Probeseite: Tesseract liest die Musterfotos, Ergebnis zum Kopieren, nichts geht nach außen', async ({
  page,
  context,
  browserName,
  baseURL,
}) => {
  test.skip(browserName !== 'chromium', 'Tesseract als WebAssembly nur in Chromium geprüft');
  test.setTimeout(240_000);
  const fremd: string[] = [];
  context.on('request', (r) => {
    const url = r.url();
    if (!/^(blob|data):/.test(url) && !url.startsWith(baseURL!)) fremd.push(url);
  });
  // Vier Fotos statt 59, damit der Test kurz bleibt: Abrechnung, Ausweis hinten, Pass, Pass in OCR-B.
  await page.route('**/probe/fotos.json', async (r) => {
    const alle = (await (await r.fetch()).json()) as { datei: string }[];
    const wahl = [
      'gehalt-scan.jpg',
      'ausweis-hinten-scan.jpg',
      'pass-scan.jpg',
      'pass-ocrb-scan.jpg',
    ];
    await r.fulfill({ json: alle.filter((f) => wahl.includes(f.datei)) });
  });
  await haushaltMitMax(page);
  await page.goto('/#/einstellungen');
  await page.getByRole('link', { name: /Probe: Vision gegen Tesseract/ }).click();
  await expect(page.getByText(/Probe, nicht einreichen/)).toBeVisible();
  await expect(page.getByText(/Hefta liest 4 Musterfotos/)).toBeVisible();
  await page.getByRole('button', { name: 'Probe starten' }).click();
  await expect(page.getByRole('button', { name: 'Ergebnis kopieren' })).toBeVisible({
    timeout: 220_000,
  });
  const text = await page.getByRole('textbox', { name: 'Ergebnis' }).inputValue();
  if (process.env.PROBE_ZEIGEN) console.log(text);
  expect(text).toContain('Tesseract gestartet in');
  expect(text).toMatch(/gehalt-scan\.jpg \| Tesseract \| Treffer \d+\/\d+/);
  expect(text).toMatch(/pass-scan\.jpg \| Tesseract \| .*Prüfziffern/);
  expect(text).toMatch(/gehalt-scan\.jpg \| Vision \| Fehler/);
  // Dritter Lauf (PC77): Das OCR-B-Modell lädt und liest die Zeilen unten.
  expect(text).toMatch(/pass-ocrb-scan\.jpg \| Tesseract OCR-B \| Treffer/);
  expect(text).not.toMatch(/Tesseract OCR-B \| Fehler/);
  expect(text).toContain('OCR-B | Tesseract OCR-B |');
  // Der Probelauf CP40 las die Abrechnung im Scan ganz; hier mindestens fast ganz.
  const [, gef, zahl] = /gehalt-scan\.jpg \| Tesseract \| Treffer (\d+)\/(\d+)/.exec(text)!;
  expect(Number(gef)).toBeGreaterThanOrEqual(Number(zahl) - 2);
  expect(fremd).toEqual([]);
});
