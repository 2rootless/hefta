import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { expect, test, type Page } from '@playwright/test';
import { cspMelden } from './hilfen';
import { HEUTE, SZENARIEN, datensaetze } from './szenarien';

// Bewegung nach design/README.md: Kommt eine Unterlage dazu, schließt sich die Lücke im Band
// (240 ms) und der Stein wird zum Punkt; ist danach alles da, laufen die Farben ins Haus (600 ms).
// Bei „Bewegung reduzieren“ nur Überblendungen.

async function beispielPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText('Bonitaet', { x: 60, y: 700, size: 18, font: f });
  return Buffer.from(await doc.save());
}

/** Wie 04-fertig, nur Petras Bonitätsnachweis fehlt: eine Unterlage bis „alles da“. */
async function fastFertig(page: Page) {
  const daten = datensaetze(SZENARIEN.find((s) => s.id === '04-fertig')!);
  const petraBonitaet = (daten.dokumente as { id: string; personId: string; typ: string }[]).find(
    (d) => d.personId.endsWith('-2') && d.typ === 'bonitaet',
  )!.id;
  daten.versionen = (daten.versionen as { dokumentId: string }[]).filter(
    (v) => v.dokumentId !== petraBonitaet,
  );
  await page.goto('/');
  await page.locator('h1').first().waitFor();
  await page.evaluate(async (daten) => {
    const db = await new Promise<IDBDatabase>((ok) => {
      const r = indexedDB.open('hefta');
      r.onsuccess = () => ok(r.result);
    });
    const orte = [...db.objectStoreNames];
    const tx = db.transaction(orte, 'readwrite');
    for (const ort of orte) tx.objectStore(ort).clear();
    for (const [ort, liste] of Object.entries(daten))
      for (const d of liste as object[]) tx.objectStore(ort).put(d);
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
  }, daten);
  await page.goto('about:blank');
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Hallo Max.' })).toBeVisible();
}

async function bonitaetHochladen(page: Page) {
  await page.getByRole('button', { name: /^Bonitäts/ }).click();
  const blatt = page.getByRole('dialog');
  await blatt.locator('[data-feld="pdf"]').setInputFiles({
    name: 'bonitaet.pdf',
    mimeType: 'application/pdf',
    buffer: await beispielPdf(),
  });
  await blatt.getByRole('button', { name: 'Heute' }).click();
  await blatt.getByRole('button', { name: 'Speichern' }).click();
  await expect(blatt).toBeHidden();
}

const animationen = (page: Page, attribut: string) =>
  page.locator(`.band-svg animate[attributeName="${attribut}"]`);

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
  await page.clock.setFixedTime(HEUTE);
});

test.describe('mit Bewegung', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('Lücke schließt sich, Stein wird Punkt, Farben laufen ins Haus', async ({ page }) => {
    await fastFertig(page);
    await expect(animationen(page, 'stroke-dashoffset')).toHaveCount(0);
    await bonitaetHochladen(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Alles beisammen.' })).toBeVisible();
    await expect(animationen(page, 'stroke-dashoffset')).toHaveCount(1);
    await expect(animationen(page, 'r')).toHaveCount(1);
    await expect(page.locator('.band-svg clipPath animate[attributeName="height"]')).toHaveCount(1);
    await expect(page.locator('svg.ziel.feiern')).toHaveCount(1);
    // Nach dem Neuzeichnen (andere Breite) läuft nichts von vorn, das Ende bleibt stehen.
    await page.setViewportSize({ width: 430, height: 932 });
    await expect(animationen(page, 'stroke-dashoffset')).toHaveCount(1);
    // Ein neuer Besuch der Übersicht bewegt nichts mehr.
    await page.getByRole('link', { name: /^Haushalt bearbeiten: / }).click();
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Alles beisammen.');
    await page.evaluate(() => (window.location.hash = '#/'));
    await expect(page.locator('.band-svg')).toBeVisible();
    await expect(animationen(page, 'stroke-dashoffset')).toHaveCount(0);
    await expect(page.locator('svg.ziel.feiern')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  });
});

test.describe('Bewegung reduzieren', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('nur Überblendungen: nichts wächst, schrumpft oder läuft', async ({ page }) => {
    await fastFertig(page);
    await bonitaetHochladen(page);
    await expect(animationen(page, 'opacity').first()).toBeAttached();
    await expect(animationen(page, 'stroke-dashoffset')).toHaveCount(0);
    await expect(animationen(page, 'r')).toHaveCount(0);
    await expect(page.locator('.band-svg clipPath')).toHaveCount(0);
  });
});
