import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';

// DP47 G5 mit DP47b (PC60): mehrere Lebenslagen je Person. Prüfkatalog L1, L7, L8.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 16, 10, 0));
});

async function personAendern(page: Page) {
  await page.getByRole('link', { name: /^Max Hauptmieter$/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Max' })).toBeVisible();
  await page.getByRole('link', { name: 'Ändern', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Speichern' })).toBeVisible();
}

async function dazunehmen(page: Page, lage: RegExp) {
  await page.getByRole('button', { name: /Einkommens.?quelle$/ }).click();
  const blatt = page.getByRole('dialog');
  await expect(blatt.getByText('Was kommt bei Max zu „Angestellt“ dazu?')).toBeVisible();
  await blatt.getByRole('radio', { name: lage }).click();
  await blatt.getByRole('button', { name: 'Dazunehmen' }).click();
  await expect(blatt).toBeHidden();
}

test('L1, L7, L8: Dazu noch eine Einkommensquelle, drei Lagen, erste entfernen', async ({
  page,
}) => {
  await haushaltMitMax(page);
  await personAendern(page);

  // L1: Eine Lage wie heute, nur die Zeile „Dazu noch …“ ist neu.
  await expect(
    page.getByRole('button', { name: /^Dazu noch eine Einkommens.?quelle$/ }),
  ).toBeVisible();
  await expect(page.getByText('Dazu', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: /^Dazu noch eine Einkommens.?quelle$/ }).click();
  const blatt = page.getByRole('dialog');
  // „Angestellt“ geht ein zweites Mal: zwei Arbeitgeber.
  await expect(blatt.getByRole('radio', { name: /Angestellt/ })).toContainText(
    'Noch ein Arbeitgeber, etwa ein Minijob.',
  );
  await expect(blatt.getByText(/Die Nachweise kommen auf Max’ Liste dazu\./)).toBeVisible();
  await blatt.getByRole('radio', { name: /Selbstständig/ }).click();
  await blatt.getByRole('button', { name: 'Dazunehmen' }).click();
  await expect(blatt).toBeHidden();
  await expect(page.getByText('Dazu', { exact: true })).toHaveCount(1);
  await expect(
    page.getByText('Davon hängt ab, welche Einkommensnachweise auf die Liste kommen.', {
      exact: false,
    }),
  ).toBeVisible();

  // L7: drei Lagen; der Kopf nennt alle drei.
  await dazunehmen(page, /^In Rente/);
  await expect(page.getByText('Dazu', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Max' })).toBeVisible();
  await expect(
    page.getByText(/Angestellt, dazu selbstständig oder freiberuflich und in Rente/),
  ).toBeVisible();

  // L8: die erste entfernen: die zweite rückt nach oben und steht zuerst.
  await page.getByRole('link', { name: 'Ändern', exact: true }).click();
  await page.getByRole('button', { name: 'Angestellt entfernen' }).click();
  await expect(page.getByText('Dazu', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText(/Selbstständig oder freiberuflich, dazu in Rente/)).toBeVisible();
});

test('L4: zweimal angestellt: zwei Reihen Gehaltsnachweise, die zweite eigen befüllbar', async ({
  page,
}) => {
  const fehler: string[] = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  await haushaltMitMax(page);
  await personAendern(page);
  await dazunehmen(page, /^Angestellt/);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Max' })).toBeVisible();

  const reihen = page.getByRole('link', { name: /^Gehalts.?nachweise/ });
  await expect(reihen).toHaveCount(2);
  await expect(reihen.nth(0)).toContainText('Angestellt. ');
  await expect(reihen.nth(1)).toContainText('Noch ein Arbeitgeber. ');

  // Die zweite Reihe hat ihre eigene Seite und eigene Abrechnungen.
  await reihen.nth(1).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Gehalts.?nachweise/);
  await expect(page).toHaveURL(/gehaltsnachweis2$/);
  await page.locator('.leiste .haupt').click();
  const blatt = page.getByRole('dialog');
  await blatt.locator('[data-feld="pdf"]').setInputFiles({
    name: 'minijob-oktober.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
    ),
  });
  await blatt.getByRole('button', { name: 'Speichern' }).click();
  await expect(blatt).toBeHidden();
  await page.getByRole('link', { name: 'Max', exact: true }).click();
  await expect(reihen.nth(0)).toContainText('Fehlt noch');
  await expect(reihen.nth(1)).not.toContainText('Fehlt noch, die letzten');
  expect(fehler).toEqual([]);
});

async function einkommenOeffnen(page: Page) {
  await page.getByRole('link', { name: /^Selbst.?auskunft/ }).click();
  await page.getByRole('button', { name: /^Einkommen/ }).click();
}

test('L9: Einkommen je Quelle, „Zusammen“ zeigt die Summe und beide Teile', async ({ page }) => {
  await haushaltMitMax(page);
  await personAendern(page);
  await dazunehmen(page, /^Selbstständig/);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await einkommenOeffnen(page);
  await expect(
    page.getByText(
      'Netto, für jede Quelle einzeln. Hefta zählt zusammen und zeigt die Summe hier.',
    ),
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'Netto im Monat' }).first().fill('2850');
  await page.locator('[data-feld="lage-netto-0"]').fill('400');
  await expect(page.getByText('Zusammen', { exact: true })).toBeVisible();
  await expect(page.getByText('3.250 € netto')).toBeVisible();
  await expect(page.getByText(/die Summe und darunter beide Beträge/)).toBeVisible();
});

test('DP47b K1: Leistungen vom Amt, dazu angestellt: Schalter aus, dann an', async ({ page }) => {
  await haushaltMitMax(page);
  await personAendern(page);
  await page
    .getByLabel(/Woher kommt/)
    .selectOption({ label: 'Miete zahlt eine öffentliche Stelle' });
  await page.getByRole('button', { name: /^Dazu noch eine Einkommens.?quelle$/ }).click();
  const blatt = page.getByRole('dialog');
  await blatt.getByRole('radio', { name: /^Angestellt/ }).click();
  await blatt.getByRole('button', { name: 'Dazunehmen' }).click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(
    page.getByText(/Gehaltsnachweise stehen nicht auf der Liste, weil das Amt die Miete übernimmt/),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /^Gehalts.?nachweise/ })).toHaveCount(0);

  await einkommenOeffnen(page);
  const schalter = page.getByRole('switch', { name: /Einkommen trotzdem angeben/ });
  await expect(schalter).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('textbox', { name: 'Netto im Monat' })).toHaveCount(0);
  await schalter.click();
  await page.getByRole('textbox', { name: 'Netto im Monat' }).fill('520');
  await expect(page.getByText('So steht es im Bogen')).toBeVisible();
  await expect(page.getByText('ohne Betrag')).toBeVisible();
  await expect(page.getByText('Zusammen', { exact: true })).toHaveCount(0);
});

test('M1, M2: Abstand zwischen Nachbarn und Schrift in Flächen, 390 und 320 px mit 130 %', async ({
  page,
}) => {
  const { abstandPruefen } = await import('./abstand');
  await haushaltMitMax(page);
  await personAendern(page);
  await dazunehmen(page, /^Selbstständig/);
  const befunde: Record<string, unknown> = {};
  const messen = async (wo: string) => {
    for (const breite of [390, 246]) {
      await page.setViewportSize({ width: breite, height: breite === 390 ? 844 : 437 });
      await page.waitForTimeout(200);
      const r = await page.evaluate(abstandPruefen);
      if (r.eng.length || r.raus.length) befunde[`${wo} ${breite}`] = r;
    }
  };
  await messen('Max ändern');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Max', exact: true })).toBeVisible();
  await messen('Personenseite');
  await page.setViewportSize({ width: 390, height: 844 });
  await einkommenOeffnen(page);
  await page.getByRole('textbox', { name: 'Netto im Monat' }).first().fill('2850');
  await page.locator('[data-feld="lage-netto-0"]').fill('400');
  await messen('Einkommen');
  expect(befunde).toEqual({});

  // M2, Gegenprobe: zu enge Nachbarn und Schrift am Rand einer Fläche schlagen an.
  await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const zeile = document.createElement('div');
    zeile.style.setProperty('display', 'flex');
    zeile.innerHTML = '<span>Zusammen</span><span>3.250 €</span>';
    const pille = document.createElement('span');
    pille.style.setProperty('background', '#222');
    pille.style.setProperty('color', '#fff');
    pille.textContent = 'Entfernen';
    main.prepend(zeile, pille);
  });
  const rot = await page.evaluate(abstandPruefen);
  expect(rot.eng.some((x) => x.includes('Zusammen'))).toBe(true);
  expect(rot.raus.some((x) => x.includes('Entfernen'))).toBe(true);
});

test('L12: dunkel, 320 px mit 130 %: G5-Bildschirme ohne Befund, kein Überlauf', async ({
  page,
}) => {
  const { pruefen } = await import('./pruef-c');
  await page.emulateMedia({ colorScheme: 'dark' });
  await haushaltMitMax(page);
  await personAendern(page);
  await dazunehmen(page, /^Selbstständig/);
  await dazunehmen(page, /^In Rente/);
  await page.setViewportSize({ width: 246, height: 437 });
  const befunde: Record<string, unknown> = {};
  const messen = async (wo: string) => {
    await page.waitForTimeout(300);
    const r = await page.evaluate(pruefen);
    const rest = Object.fromEntries(
      Object.entries(r).filter(([k, v]) => k !== 'hoehe' && (Array.isArray(v) ? v.length : !!v)),
    );
    if (Object.keys(rest).length) befunde[wo] = rest;
    const ueber = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (ueber) befunde[`${wo} Überlauf`] = ueber;
  };
  await messen('Max ändern');
  await page.getByRole('button', { name: /^Noch eine Einkommens.?quelle$/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await messen('Dazu wählen');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Max', exact: true })).toBeVisible();
  await page.reload();
  await messen('Personenseite');
  await einkommenOeffnen(page);
  await page.getByRole('textbox', { name: 'Netto im Monat' }).first().fill('2850');
  await page.locator('[data-feld="lage-netto-0"]').fill('400');
  await messen('Einkommen');
  expect(befunde).toEqual({});
});
