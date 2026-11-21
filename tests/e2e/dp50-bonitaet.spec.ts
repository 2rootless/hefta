import { expect, test, type Page } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// DP50 Punkt 13: Beim Bonitätsnachweis zeigt der Rutsch „Woran ihr sie erkennt“: die Auskunft für
// Vermieter („Diese“, im Ton von „passt“) neben der kostenlosen Datenkopie („Nicht diese“, grau). Ohne Rot.
// Bei 320 px mit 130 % stehen die Papiere untereinander, das Bild 64 px breit.

async function zurBonitaet(page: Page) {
  await szenarioLaden(page, '03-mehrere-offen', '/rutsch');
  await page.getByRole('button', { name: /^Los geht/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Gehalts/ })).toBeVisible();
  // Gegenprobe: Bei den Gehaltsnachweisen steht die Karte nicht.
  await expect(page.getByRole('region', { name: 'Woran ihr sie erkennt' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Bonitäts/ })).toBeVisible();
}

test('Bonität: „Woran ihr sie erkennt“, Diese und Nicht diese, ohne Rot', async ({ page }) => {
  await zurBonitaet(page);
  const karte = page.getByRole('region', { name: 'Woran ihr sie erkennt' });
  await expect(karte).toBeVisible();
  await expect(karte.locator('.papier')).toHaveCount(2);
  await expect(karte.locator('.papier').first()).toContainText('Diese');
  await expect(karte.locator('.papier').first()).toContainText('Auskunft für Vermieter');
  await expect(karte.locator('.papier').first()).toContainText(
    'Eine Seite. Nur was für die Miete zählt, mit Code zum Prüfen.',
  );
  await expect(karte.locator('.papier').last()).toContainText('Nicht diese');
  await expect(karte.locator('.papier').last()).toContainText('Kostenlose Datenkopie');
  // Die Karte steht vor „PDF wählen“.
  const kartenUnten = await karte.evaluate((e) => e.getBoundingClientRect().bottom);
  const kachelOben = await page
    .locator('label.kachel')
    .evaluate((e) => e.getBoundingClientRect().top);
  expect(kartenUnten).toBeLessThanOrEqual(kachelOben);
  // W5: nichts in der Farbe des Zurück-Links.
  const akzent = await page
    .locator('a.zurueck')
    .first()
    .evaluate((e) => getComputedStyle(e).color);
  const farben = await karte
    .locator('*')
    .evaluateAll((alle) => alle.map((e) => getComputedStyle(e).color));
  expect(farben).not.toContain(akzent);
});

test('320 px mit 130 %, dunkel: untereinander, Bild 64 px, Papier bleibt weiß, kein Überlauf', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await zurBonitaet(page);
  await page.setViewportSize({ width: 246, height: 437 });
  const karte = page.getByRole('region', { name: 'Woran ihr sie erkennt' });
  const [a, b] = await karte
    .locator('.papier')
    .evaluateAll((p) => p.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
  expect(b!.top).toBeGreaterThanOrEqual(a!.bottom);
  const breite = await karte
    .locator('svg')
    .first()
    .evaluate((e) => e.getBoundingClientRect().width);
  expect(Math.round(breite)).toBe(64);
  expect(
    await karte
      .locator('.blatt')
      .first()
      .evaluate((e) => getComputedStyle(e).fill),
  ).toBe('rgb(255, 255, 255)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});
