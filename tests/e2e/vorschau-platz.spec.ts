import { PDFDocument } from '@cantoo/pdf-lib';
import { expect, test, type Page } from '@playwright/test';
import { HEUTE, SZENARIEN, datensaetze } from './szenarien';

// PC70, Abschnitt 1 (W8, CP44): In „Mappe anpassen“ steht der Platz der Vorschau von Anfang an frei, im Ton der
// Vorschau, mit „Vorschau wird erstellt …“. Die Höhe kommt aus der letzten Vorschau, beim ersten Mal ist sie
// fest. Geprüft: Die Lage von „Bestandteile“ ist vor und nach der Vorschau gleich. Gegenprobe: Mit einer
// falsch gemerkten Höhe springt „Bestandteile“, und die Prüfung schlägt an.

// Ohne Service Worker, damit page.route das Nachladen der Vorschau auch in WebKit bremsen kann.
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

const SCHLUESSEL = 'hefta-vorschau-verhaeltnis';

async function laden(page: Page) {
  const leer = await PDFDocument.create();
  leer.addPage([595, 842]);
  const pdf = [...(await leer.save())];
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  await page.evaluate(
    async ({ daten, pdf }) => {
      const db = await new Promise<IDBDatabase>((ok) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => ok(r.result);
      });
      const orte = [...db.objectStoreNames];
      const tx = db.transaction(orte, 'readwrite');
      for (const ort of orte) tx.objectStore(ort).clear();
      for (const [ort, liste] of Object.entries(daten))
        for (const d of liste as object[]) tx.objectStore(ort).put(d);
      for (const v of (daten as { versionen: { original: string }[] }).versionen)
        tx.objectStore('dateien').put({
          id: v.original,
          createdAt: new Date().toISOString(),
          typ: 'application/pdf',
          groesse: pdf.length,
          daten: new Uint8Array(pdf).buffer,
        });
      await new Promise((ok) => (tx.oncomplete = ok));
      db.close();
    },
    { daten: datensaetze(SZENARIEN.find((s) => s.id === '01-standard')!), pdf },
  );
}

/** Öffnet „Mappe anpassen“ neu und gibt die Lage von „Bestandteile“ vor und nach der Vorschau zurück. */
async function lageVorUndNach(page: Page) {
  await page.goto('about:blank');
  await page.goto('/#/mappe/anpassen');
  const platz = page.getByText('Vorschau wird erstellt …');
  await expect(platz).toBeVisible();
  const bestandteile = page.getByRole('heading', { level: 2, name: 'Bestandteile' });
  const vor = (await bestandteile.boundingBox())!.y;
  // Fertig heißt: die Vorschau steht da, ihre Bilder sind geladen.
  const vorschau = page.getByRole('button', { name: /Vorschau eurer Mappe groß ansehen/ });
  await expect(vorschau).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() =>
      vorschau.locator('img').evaluateAll((b) => b.every((i) => (i as HTMLImageElement).complete)),
    )
    .toBe(true);
  await expect(vorschau).not.toHaveAttribute('style', /aspect-ratio/);
  const nach = (await bestandteile.boundingBox())!.y;
  // Ohne Service Worker (hier gesperrt) läuft Hefta still weiter, ohne „Das hat nicht geklappt“ (CP46).
  await expect(page.getByText('Das hat nicht geklappt')).toHaveCount(0);
  return { vor, nach };
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(HEUTE);
  // Den Baustein der Vorschau eine Sekunde bremsen: So ist der Zustand davor sicher zu sehen.
  await page.route('**/assets/mappeVorschau-*.js', async (route) => {
    await new Promise((fertig) => setTimeout(fertig, 1000));
    await route.continue();
  });
  await laden(page);
});

for (const breite of [390, 320]) {
  test(`Mappe anpassen: Der Platz der Vorschau steht frei, „Bestandteile“ springt nicht (W8), ${breite} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: breite, height: 844 });
    // Beim ersten Mal gilt das Verhältnis aus der Messung bei dieser Breite (PC187). Unter Linux liegt die Schrift
    // anders; dort waren es 14 px mehr als hier. Darum bleibt die Grenze bei 320 px 20 px.
    await page.evaluate((s) => localStorage.removeItem(s), SCHLUESSEL);
    const erstes = await lageVorUndNach(page);
    expect(Math.abs(erstes.nach - erstes.vor)).toBeLessThanOrEqual(breite === 390 ? 1 : 20);
    expect(await page.evaluate((s) => localStorage.getItem(s), SCHLUESSEL)).not.toBeNull();
    // Danach merkt sich Hefta das Verhältnis: Die Lage ist vorher und nachher gleich.
    const zweites = await lageVorUndNach(page);
    expect(Math.abs(zweites.nach - zweites.vor)).toBeLessThanOrEqual(1);
  });
}

test('Gegenprobe: Mit falsch gemerkter Höhe springt „Bestandteile“, die Prüfung schlägt an', async ({
  page,
}) => {
  await page.evaluate((s) => localStorage.setItem(s, '0.3'), SCHLUESSEL);
  const falsch = await lageVorUndNach(page);
  expect(Math.abs(falsch.nach - falsch.vor)).toBeGreaterThan(20);
});
