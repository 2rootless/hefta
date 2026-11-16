import { expect, test, type Page } from '@playwright/test';
import { markerPruefen } from './dp39-regeln';
import { gehaltsPdfs, szenarioLaden } from './szenario-laden';

// PC64, Punkt 4 (W20): Beim Gehaltsnachweis stehen der Monat und der Name der Person in der Vorschau wie
// mit Textmarker, für Hauptmieter, Mitmieterin und Bürgin. Gerade bei der Bürgin muss der Name zu ihr
// passen: Ein Nachweis von Max mit demselben Nachnamen zeigt bei ihr nur den Monat.

async function hochladen(page: Page, person: number, name: string) {
  await szenarioLaden(page, '01-standard', `/unterlage/p-01-standard-${person}/gehaltsnachweis`);
  // Der Knopf für die nächste Abrechnung („September hinzufügen“), nicht „Notiz hinzufügen …“.
  await page
    .getByRole('button', { name: /hinzufügen/i })
    .filter({ hasNotText: 'Notiz' })
    .first()
    .click();
  await page
    .locator('[data-feld="pdf"]')
    .setInputFiles(await gehaltsPdfs(['August', 'September'], name));
  const vorschau = page.getByRole('dialog').locator('.w16-vorschau');
  await expect(vorschau).toHaveCount(2, { timeout: 30_000 });
  return vorschau;
}

/** Liegt jede Markierung auf dem gerenderten Text? Ihre Mitte muss im sichtbaren Ausschnitt liegen. */
async function marken(vorschau: ReturnType<Page['locator']>) {
  return vorschau.evaluate((v) => {
    const r = v.getBoundingClientRect();
    return [...v.querySelectorAll<HTMLElement>('.marke')].map((m) => {
      const b = m.getBoundingClientRect();
      const mitte = b.top + b.height / 2;
      return { sichtbar: mitte > r.top && mitte < r.bottom, breite: Math.round(b.width) };
    });
  });
}

for (const [rolle, person, name] of [
  ['Hauptmieter', 0, 'Max Mustermann'],
  ['Mitmieterin', 1, 'Lea Mustermann'],
  ['Bürgin', 2, 'Petra Mustermann'],
] as const) {
  test(`wunsch-W20: ${rolle}: Monat und Name in der Vorschau hinterlegt`, async ({ page }) => {
    const vorschau = await hochladen(page, person, name);
    for (const i of [0, 1]) {
      await expect(vorschau.nth(i).locator('.marke')).toHaveCount(2, { timeout: 10_000 });
      const m = await marken(vorschau.nth(i));
      expect(m.every((x) => x.sichtbar && x.breite > 20)).toBe(true);
    }
    expect(await page.evaluate(markerPruefen)).toEqual([]);
    // Ein anderer Monat, nach Hand gewählt, steht nicht auf der Seite: dann nur der Name.
    await page.getByRole('dialog').locator('.w16-monat select').first().selectOption({ index: 3 });
    await expect(vorschau.first().locator('.marke')).toHaveCount(1);
  });
}

test('wunsch-W20 Gegenprobe: Nachweis von Max bei der Bürgin zeigt nur den Monat, nicht seinen Namen', async ({
  page,
}) => {
  const vorschau = await hochladen(page, 2, 'Max Mustermann');
  await expect(vorschau.first().locator('.marke')).toHaveCount(1, { timeout: 10_000 });
});
