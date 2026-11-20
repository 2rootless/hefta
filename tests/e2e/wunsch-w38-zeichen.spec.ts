import { expect, test } from '@playwright/test';
import { szenarioLaden } from './szenario-laden';

// wunsch-W38 und W10 (PC140, DP88): Auf der Seite „Backup“ steht 48 pt über dem Titel das Zweitblatt. Mit Passwort
// trägt es den kleinen Schlüssel, ohne Passwort nie. Gegenprobe: wählt man „Ohne Passwort“, ist der Schlüssel weg.

test('Backup-Seite: Zweitblatt über dem Titel, Schlüssel nur mit Passwort', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await szenarioLaden(page, '04-fertig', '/einstellungen/backup');
  const zeichen = page.locator('img.backup-zeichen');
  await expect(zeichen).toBeVisible();
  const titel = page.locator('main h1').first();
  const [z, h] = [await zeichen.boundingBox(), await titel.boundingBox()];
  expect(z!.width).toBe(48);
  expect(z!.height).toBe(48);
  expect(z!.y + z!.height).toBeLessThanOrEqual(h!.y);

  // Standard ist „Mit Passwort“: Zeichen mit Schlüssel.
  await expect(zeichen).toHaveAttribute('data-mit-passwort', 'true');
  await expect(zeichen).toHaveAttribute('src', /mit-passwort/);

  // „Ohne Passwort“: kein Schlüssel.
  await page.getByRole('radio').nth(1).click();
  await expect(zeichen).toHaveAttribute('data-mit-passwort', 'false');
  await expect(zeichen).not.toHaveAttribute('src', /mit-passwort/);
  const svg = await page.evaluate(
    async (src) => (await fetch(src)).text(),
    (await zeichen.getAttribute('src'))!,
  );
  expect(svg.includes('<circle')).toBe(false);
});
