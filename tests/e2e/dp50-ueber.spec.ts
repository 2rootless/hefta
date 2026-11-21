import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';
import { pdfMit } from './szenario-laden';

// DP50, „Über die Wohnung“ geprüft (CP39): Ü1 Großbuchstaben mit 18 px Zeilenhöhe, Ü2 Zeichen an der ersten
// Zeile (Pfeile mittig), Ü3 „31. März 2027“ und „Nr. 004711“ nie getrennt, Ü5 bei 320 px mit 130 % Titel
// und Schalter in einer Zeile, der Satz darunter über die ganze Breite.

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

test('Ü1 bis Ü5: Zeilenhöhe, Zeichen oben, geschützte Leerzeichen, Schalter schmal; Gegenprobe', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 10, 16, 10, 0));
  await haushaltMitMax(page);
  await hefte(page);
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
  const teil = page.locator('section.heft-haushalt');
  // Ü3: geschützte Leerzeichen.
  // Ü3 für das Datum: Der Muster-Schein hat hier keins; tagZusammen setzt es (siehe Vitest i18n).
  await expect(teil).toContainText('Nr.\u00a0004711');
  // Ü1: 18 px Zeilenhöhe bei den Großbuchstaben.
  expect(await teil.locator('.et').evaluate((e) => getComputedStyle(e).lineHeight)).toBe('18px');
  // Ü2: Zeichen an der ersten Zeile, Pfeil mittig.
  const lage = () =>
    teil.locator('a.zeile').evaluateAll((zeilen) =>
      zeilen
        .filter((z) => z.querySelector('.zeichen'))
        .map((z) => {
          const r = (s: string) => z.querySelector(s)!.getBoundingClientRect();
          const zeile = z.getBoundingClientRect();
          const mitte = (q: DOMRect) => q.top + q.height / 2;
          return {
            zeichen: Math.abs(mitte(r('.zeichen')) - mitte(r('.tx b'))),
            pfeil: Math.abs(mitte(r('.pfeil')) - mitte(zeile)),
            hoch: zeile.height,
          };
        }),
    );
  const vorher = await lage();
  expect(vorher.length).toBeGreaterThan(0);
  for (const l of vorher) {
    expect(l.zeichen).toBeLessThan(4);
    expect(l.pfeil).toBeLessThan(4);
  }
  // Gegenprobe: mittig gesetzt stünde das Zeichen in hohen Zeilen tiefer als der Titel.
  await page.evaluate(() =>
    document.styleSheets[0]!.insertRule('.heft-haushalt .zeile{align-items:center!important}', 0),
  );
  expect(Math.max(...(await lage()).map((l) => l.zeichen))).toBeGreaterThan(6);
  await page.evaluate(() => document.styleSheets[0]!.deleteRule(0));

  // Ü5: schmal Titel und Schalter in einer Zeile, der Satz darunter über die ganze Breite.
  await page.setViewportSize({ width: 246, height: 437 });
  const schalter = teil.getByRole('switch', { name: /Sozial.?wohnung/ });
  const m = await schalter.evaluate((s) => {
    const r = (q: string) => s.querySelector(q)!.getBoundingClientRect();
    return { b: r('.tx b'), bahn: r('.bahn'), satz: r('.tx small') };
  });
  expect(m.satz.top).toBeGreaterThanOrEqual(m.bahn.bottom - 2);
  expect(m.satz.right).toBeGreaterThan(m.bahn.left);
  expect(Math.abs(m.b.top + m.b.height / 2 - (m.bahn.top + m.bahn.height / 2))).toBeLessThan(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});
