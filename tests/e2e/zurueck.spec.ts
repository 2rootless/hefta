import { expect, test, type Page } from '@playwright/test';
import { haushaltMitMax } from './einrichtung';

// Zurück auf jeder Seite (Auftraggeber 13.11., docs/zurueck-pruefung-2026-11-13.md): Reiter sind Wurzeln,
// jede andere Seite führt zur Seite darüber und nennt sie.

const stelle = (page: Page) =>
  page.evaluate(() => (history.state as { stelle?: number } | null)?.stelle ?? -1);
const reiter = (page: Page, name: 'Wohnungen' | 'Mappe') =>
  page.getByRole('navigation', { name: 'Bereiche' }).getByRole('link', { name });

test('Reiterwechsel beginnt den Verlauf neu; Einstellungen nennen den Reiter, aus dem man kam', async ({
  page,
}) => {
  await haushaltMitMax(page);

  // Mappe → Einstellungen → ‹ Mappe
  await reiter(page, 'Mappe').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Deine Mappe' })).toBeVisible();
  await expect.poll(() => stelle(page)).toBe(0);
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  const zurueck = page.locator('a.zurueck');
  await expect(zurueck).toHaveText('Mappe');
  await zurueck.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Deine Mappe' })).toBeVisible();

  // Wohnungen → Einstellungen → ‹ Wohnungen; auf dem Reiter selbst kein Schritt zurück.
  await reiter(page, 'Wohnungen').click();
  await expect(page).toHaveURL(/#\/wohnungen$/);
  await expect.poll(() => stelle(page)).toBe(0);
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  await expect(zurueck).toHaveText('Wohnungen');
  await zurueck.click();
  await expect(page).toHaveURL(/#\/wohnungen$/);
  await expect.poll(() => stelle(page)).toBe(0);

  // Hin und her: Der Verlauf wird nicht länger.
  await reiter(page, 'Mappe').click();
  await reiter(page, 'Wohnungen').click();
  await reiter(page, 'Mappe').click();
  await expect.poll(() => stelle(page)).toBe(0);
});

test('Seite einer Person nennt „Mappe“, nicht mehr „Übersicht“', async ({ page }) => {
  await haushaltMitMax(page);
  await page.goto('/#/');
  await page.getByRole('link', { name: /^Max/ }).first().click();
  await expect(page.locator('a.zurueck')).toHaveText('Mappe');
  await page.locator('a.zurueck').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Deine Mappe' })).toBeVisible();
});
