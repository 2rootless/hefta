import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { pdfMit } from './szenario-laden';

// Nur auf Wunsch (UEBER_BILDER=1): Bilder von „Über die Wohnung“ im Heft für Design (PC62, Abschnitt 3),
// hell bei 390 px und bei 320 px mit 130 %, einmal mit Schein und Genossenschaft, einmal leer.
test.skip(!process.env.UEBER_BILDER, 'nur mit UEBER_BILDER=1');

const ORDNER = 'test-results/ueber-die-wohnung';

async function hefte(page: Page) {
  const leer = {
    beworben: null,
    gefragtAm: null,
    termin: null,
    ergebnis: null,
    loeschbitteAm: null,
    nachgefasstAm: null,
    abgelegtAm: null,
  };
  const heft = (id: string, adresse: string) => ({
    id,
    createdAt: '2026-11-14T10:00:00.000Z',
    updatedAt: '2026-11-14T10:00:00.000Z',
    haushaltId: null,
    adresse,
    link: null,
    quelle: '',
    inseratText: null,
    kennung: `k-${id}`,
    ereignisse: leer,
    notiz: '',
    angaben: { titel: null, stadtteil: null, warm: null, zimmer: null, flaeche: null },
  });
  await page.evaluate(
    (liste) =>
      new Promise<void>((fertig) => {
        const r = indexedDB.open('hefta');
        r.onsuccess = () => {
          const tx = r.result.transaction('hefte', 'readwrite');
          for (const h of liste) tx.objectStore('hefte').put(h);
          tx.oncomplete = () => {
            r.result.close();
            fertig();
          };
        };
      }),
    [heft('leer', 'Lindenring 3\n20259 Hamburg'), heft('voll', 'Lindenring 8\n20259 Hamburg')],
  );
  await page.reload();
}

const gehe = (page: Page, pfad: string) =>
  page.evaluate((h) => (window.location.hash = h), `#${pfad}`);

async function bilder(page: Page, id: string, name: string) {
  for (const [breite, hoehe, kurz] of [
    [390, 844, '390'],
    [246, 437, '320-130'],
  ] as const) {
    await page.setViewportSize({ width: breite, height: hoehe });
    await gehe(page, '/');
    await page.reload();
    await gehe(page, `/heft/${id}`);
    const teil = page.locator('section.heft-haushalt');
    await teil.scrollIntoViewIfNeeded();
    // Feste Leisten (Reiter unten) liegen sonst im Bild über dem Abschnitt.
    await page.evaluate(() =>
      document.querySelectorAll<HTMLElement>('body *').forEach((e) => {
        if (getComputedStyle(e).position === 'fixed') e.style.setProperty('visibility', 'hidden');
      }),
    );
    await page.waitForTimeout(400);
    await teil.screenshot({ path: `${ORDNER}/${name}-${kurz}.png` });
  }
}

test('Über die Wohnung: Bilder für Design', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 16, 10, 0));
  await page.emulateMedia({ colorScheme: 'light' });
  await haushaltMitMax(page);
  await hefte(page);

  // Leer: kein Schein, keine Genossenschaft, Schalter aus.
  await bilder(page, 'leer', 'leer');

  // Mit Schein und Genossenschaft.
  await page.setViewportSize({ width: 390, height: 844 });
  await gehe(page, '/haushalt-unterlage/wbs');
  await page.locator('input[data-feld="pdf"]').setInputFiles({
    name: 'WBS.pdf',
    mimeType: 'application/pdf',
    buffer: await pdfMit(['Wohnberechtigungsschein\nGültig bis 31.03.2027\nFür 3 Personen']),
  });
  await page.locator('select[data-feld="personen"]').selectOption({ label: 'Drei' });
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('section.haushalt-unterlagen')).toBeVisible();
  await gehe(page, '/haushalt-unterlage/genossenschaft/neu');
  await page.locator('input[data-feld="geno-name"]').fill('Wohnungsgenossenschaft Muster eG');
  await page.locator('input[data-feld="geno-nummer"]').fill('004711');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('section.haushalt-unterlagen')).toBeVisible();
  await gehe(page, '/heft/voll');
  await page
    .locator('section.heft-haushalt')
    .getByRole('switch', { name: /Sozial.?wohnung/ })
    .click();
  await page
    .locator('section.heft-haushalt')
    .getByRole('link', { name: /Wer vermietet/ })
    .click();
  await page.getByRole('switch', { name: /Muster eG/ }).click();
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(page.locator('section.heft-haushalt')).toContainText('aus der Mappe');
  await bilder(page, 'voll', 'mit-schein-und-genossenschaft');
});
