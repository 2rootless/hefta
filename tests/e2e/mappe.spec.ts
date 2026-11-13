import AxeBuilder from '@axe-core/playwright';
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { animationenFertig, cspMelden } from './hilfen';
import { HEUTE, SZENARIEN, datensaetze } from './szenarien';

// Abnahme M5 (Mappe erstellen, X1–X9): Vorschau, Modi, Bürgin abwählen, Adresse, Dateiname,
// Einzeldateien; das geteilte PDF hat neutrale Metadaten und die angezeigte Seitenzahl.

async function beispielPdf(): Promise<number[]> {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText('Beispielseite', { x: 60, y: 700, size: 18, font: f });
  return [...(await doc.save())];
}

async function laden(page: Page, szenario: string) {
  const s = SZENARIEN.find((x) => x.id === szenario)!;
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
    { daten: datensaetze(s), pdf: await beispielPdf() },
  );
  await page.goto('about:blank');
  await page.goto('/#/mappe');
  await expect(page.getByRole('heading', { level: 1, name: 'Mappe teilen' })).toBeVisible();
}

const seitenZahl = (page: Page) => page.getByText(/^\d+ Seiten?$/);

async function warten(page: Page) {
  await expect(page.getByRole('button', { name: 'PDF ansehen' })).toBeVisible({
    timeout: 30_000,
  });
}

test.beforeEach(async ({ page }) => {
  await cspMelden(page);
  await page.clock.setFixedTime(HEUTE);
});

test('Mappe erstellen: Vorschau, Modi, Bürgin abwählen, Adresse, Download', async ({
  page,
  browserName,
}, info) => {
  await laden(page, '04-fertig');
  await warten(page);
  await expect(page.getByRole('radio', { name: /^Nur das Übliche/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  const marktSeiten = Number((await seitenZahl(page).innerText()).split(' ')[0]);
  if (browserName === 'chromium') {
    await animationenFertig(page);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
  }

  // Download (im Test-Browser gibt es kein Teilen-Blatt): Dateiname, Seiten, neutrale Metadaten.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF ansehen' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('Bewerbung_Mustermann.pdf');
  const pfad = info.outputPath('mappe.pdf');
  await download.saveAs(pfad);
  const pdf = await PDFDocument.load(readFileSync(pfad), { updateMetadata: false });
  expect(pdf.getPageCount()).toBe(marktSeiten);
  expect(pdf.getTitle()).toContain('Max');
  expect(pdf.getAuthor()).toBe('Max Mustermann');
  expect(pdf.getProducer()).toBeUndefined();

  // Kopfband, Fußzeile und Lesezeichen im echten Ablauf (design/mappe-pdf.md).
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const dok = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(pfad)) }).promise;
  const inhalt = await (await dok.getPage(2)).getTextContent();
  const text = inhalt.items.map((i) => ('str' in i ? i.str : '')).join(' ');
  expect(text).toContain('Max Mustermann');
  expect(text).toContain('Hauptmieter');
  expect(text).toContain(`Seite 2 von ${marktSeiten}`);
  const lesezeichen = (await dok.getOutline()) ?? [];
  expect(lesezeichen.map((l) => l.title)).toContain('Max Mustermann (Hauptmieter)');

  // Bürgin für diese Bewerbung abwählen (X4): weniger Seiten.
  await page.getByRole('checkbox', { name: /Petra/ }).click();
  await expect(page.getByRole('checkbox', { name: /Petra/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await expect(page.getByText('Nicht in dieser Mappe')).toBeVisible();
  await expect
    .poll(async () => Number((await seitenZahl(page).innerText()).split(' ')[0]), {
      timeout: 30_000,
    })
    .toBeLessThan(marktSeiten);

  // E49 (B17a): In „Eigene Auswahl“ hält ein Schalter die Antwort zu Mietrückständen bis zur Zusage zurück.
  await page.getByRole('button', { name: /^Eigene Auswahl/ }).click();
  const miet = page.getByRole('switch', {
    name: /^Mietrückstände erst nach der Zusage beantworten/,
  });
  await expect(miet).toHaveAttribute('aria-checked', 'false');
  await miet.click();
  await expect(miet).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(/„Beantworten wir nach der Zusage“/)).toBeVisible();
  await miet.click();
  await page.getByRole('radio', { name: /^Nur das Übliche/ }).click();

  // Adresse eintragen (seit B23 über die große Ansicht des Deckblatts): Deckblatt und Dateiname.
  await page.evaluate(() => (location.hash = '#/mappe/deckblatt'));
  await page.getByRole('button', { name: 'Wohnung ändern' }).click();
  await page
    .getByLabel('Adresse der Wohnung (freiwillig)')
    .fill('Hauptstraße 12, 3. OG links\n22767 Hamburg');
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  await page.evaluate(() => (location.hash = '#/mappe'));
  await expect(page.getByRole('heading', { level: 1, name: 'Mappe teilen' })).toBeVisible();
  await warten(page);
  const [zweiter] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF ansehen' }).click(),
  ]);
  expect(zweiter.suggestedFilename()).toBe('Bewerbung_Mustermann_Hauptstr12.pdf');

  // Mappe anpassen (X8): Einzeldateien, dann „Alle teilen“ und eine Liste der Dateien (X7).
  await page.evaluate(() => (location.hash = '#/mappe/anpassen'));
  await expect(page.getByRole('heading', { level: 1, name: 'Mappe anpassen' })).toBeVisible();
  await page.getByRole('radio', { name: 'Einzeldateien' }).click();
  await page.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.getByRole('button', { name: 'Alle teilen' })).toBeVisible();
  await expect(page.getByText(/^\d+ Dateien$/)).toBeVisible({ timeout: 30_000 });
  await page
    .getByRole('button', { name: /^Dateien ansehen/ })
    .first()
    .click();
  await expect(page.getByText(/^01_.?Selbst/)).toBeVisible();
  await page.keyboard.press('Escape');

  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});

test('K8: Die Mappe wartet auf den Namen in lateinischen Buchstaben, im PDF steht genau dieser', async ({
  page,
}, info) => {
  await laden(page, '24-name-ohne-latein');
  await expect(page.getByText(/^Bei Олена fehlt noch der Name in lateinischen/)).toBeVisible();
  await expect(page.getByText('Es fehlt noch: Name in lateinischen Buchstaben')).toBeVisible();
  await expect(page.getByRole('button', { name: 'PDF ansehen' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Name eintragen' }).click();
  await expect(
    page.getByText('Die Mappe schreibt Namen in lateinischen Buchstaben.'),
  ).toBeVisible();
  const speichern = page.getByRole('button', { name: 'Speichern' });
  await expect(speichern).toHaveAttribute('aria-disabled', 'true');
  await page.getByLabel('Vorname in der Mappe').fill('Olena');
  await expect(speichern).toHaveAttribute('aria-disabled', 'true');
  await page.getByLabel('Nachname in der Mappe').fill('Коваленко');
  await expect(speichern).toHaveAttribute('aria-disabled', 'true');
  await page.getByLabel('Nachname in der Mappe').fill('Kovalenko');
  await speichern.click();
  await page.waitForURL((u) => !u.hash.includes('person-aendern'));

  await page.evaluate(() => (location.hash = '#/mappe'));
  await warten(page);
  await expect(page.getByText(/fehlt noch der Name in lateinischen/)).toHaveCount(0);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF ansehen' }).click(),
  ]);
  expect(download.suggestedFilename()).toContain('Kovalenko');
  const pfad = info.outputPath('k8.pdf');
  await download.saveAs(pfad);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const dok = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(pfad)) }).promise;
  let alles = '';
  for (let n = 1; n <= dok.numPages; n++) {
    const inhalt = await (await dok.getPage(n)).getTextContent();
    alles += inhalt.items.map((i) => ('str' in i ? i.str : '')).join(' ');
  }
  expect(alles).toContain('Olena Kovalenko');
  expect(alles).toContain('Max Mustermann und Olena Kovalenko');
  expect(alles).not.toContain('Олена');
  expect(alles).not.toContain('?');

  // In Hefta selbst bleibt der Name, wie er eingetragen ist.
  await page.evaluate(() => (location.hash = '#/'));
  await expect(page.getByText('Олена', { exact: false }).first()).toBeVisible();
});

test('K8: Neue Person in anderer Schrift, die Felder erscheinen und verschwinden wieder', async ({
  page,
}) => {
  await laden(page, '04-fertig');
  await page.evaluate(() => (location.hash = '#/person-neu/mitmieter'));
  await page.getByLabel('Vorname', { exact: true }).fill('Max');
  await expect(page.getByLabel('Vorname in der Mappe')).toHaveCount(0);
  await page.getByLabel('Vorname', { exact: true }).fill('Nguyễn');
  await expect(page.getByLabel('Vorname in der Mappe')).toHaveCount(0);
  await page.getByLabel('Vorname', { exact: true }).fill('Олена');
  await expect(page.getByLabel('Vorname in der Mappe')).toBeVisible();
  await expect(page.getByText('Wie steht der Name im Pass?')).toBeVisible();
  await page.getByLabel('Vorname', { exact: true }).fill('Olena');
  await expect(page.getByLabel('Vorname in der Mappe')).toHaveCount(0);
});

test('Tab „Mappe“: „Mappe trotzdem teilen“ führt zu „Mappe erstellen“ mit Hinweis auf Fehlendes', async ({
  page,
}) => {
  await laden(page, '01-standard');
  await warten(page);
  await expect(
    page.getByRole('link', { name: /^Bonitäts.?nachweis von Petra Fehlt noch/ }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Mappe', exact: true }).first().click();
  await page.getByRole('button', { name: 'Mappe trotzdem teilen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mappe teilen' })).toBeVisible();
});
